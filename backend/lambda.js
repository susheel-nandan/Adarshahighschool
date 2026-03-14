const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminInitiateAuthCommand, AdminCreateUserCommand, AdminSetUserPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ── AWS Configuration ────────────────────────────────────────────────────────
const REGION = process.env.AWS_REGION || 'ap-south-1';
const PREFIX = process.env.DYNAMODB_TABLE_PREFIX || 'adarsha_';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;

const ddbClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

// Helper to get Table Name with Prefix
const T = (name) => `${PREFIX}${name}`;

// ── Middlewares ──────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    // In a real AWS setup, you'd verify the Cognito JWT passed in cookies/headers
    // For this migration, we mock session reading if you use cookies
    // req.user = verifyJwt(req.headers.authorization);
    next();
});

// ── Sub-Routers ──────────────────────────────────────────────────────────────
const authRouter = express.Router();
const adminRouter = express.Router();
const studentRouter = express.Router();

// ── AUTHENTICATION API ───────────────────────────────────────────────────────
authRouter.post('/login', async (req, res) => {
    const { role, id, password } = req.body;
    if (!role || !id || !password) return res.status(400).json({ error: 'Missing credentials' });

    try {
        // Authenticate via Cognito
        const authCommand = new AdminInitiateAuthCommand({
            AuthFlow: 'ADMIN_NO_SRP_AUTH',
            UserPoolId: USER_POOL_ID,
            ClientId: CLIENT_ID,
            AuthParameters: {
                USERNAME: id,
                PASSWORD: password,
            },
        });
        const authResponse = await cognitoClient.send(authCommand);
        
        // Fetch user data from DynamoDB based on role
        let tableName;
        let pkField;
        if (role === 'student') { tableName = 'Students'; pkField = 'student_id'; }
        else if (role === 'parent') { tableName = 'Parents'; pkField = 'parent_id'; }
        else if (role === 'admin') { tableName = 'Admins'; pkField = 'admin_id'; }
        else if (role === 'teacher') { tableName = 'Faculty'; pkField = 'teacher_id'; }
        else return res.status(400).json({ error: 'Invalid role' });

        const userItem = await docClient.send(new GetCommand({
            TableName: T(tableName),
            Key: { [pkField]: id }
        }));

        if (!userItem.Item) {
            return res.status(404).json({ error: 'User profile not found in database' });
        }

        // Normally, you set HTTPOnly cookies here with authResponse.AuthenticationResult.IdToken
        // For demonstration, we simply return success to match frontend's expectation
        return res.json({ success: true, role, user: userItem.Item, token: authResponse.AuthenticationResult.IdToken });
    } catch (err) {
        console.error('Login Error:', err);
        return res.status(401).json({ error: 'Invalid credentials or Cognito error' });
    }
});

authRouter.get('/session', async (req, res) => {
    // Implement token decryption to return session data
    // Assuming token is valid for migration purposes
    res.json({ loggedIn: true, role: 'admin' /* or extracted value */ });
});

authRouter.post('/logout', (req, res) => {
    // Clear cookies here
    res.json({ success: true });
});

app.use('/api/auth', authRouter);

// ── ADMIN API ────────────────────────────────────────────────────────────────
adminRouter.get('/students', async (req, res) => {
    try {
        const result = await docClient.send(new ScanCommand({ TableName: T('Students') }));
        res.json(result.Items || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

adminRouter.post('/students', async (req, res) => {
    const { student_id, name, dob, class: stuClass, section, password_hash } = req.body;
    try {
        // 1. Create User in Cognito
        await cognitoClient.send(new AdminCreateUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: student_id,
            MessageAction: 'SUPPRESS',
            TemporaryPassword: password_hash || 'Adarsha@123'
        }));
        await cognitoClient.send(new AdminSetUserPasswordCommand({
            UserPoolId: USER_POOL_ID,
            Username: student_id,
            Password: password_hash || 'Adarsha@123',
            Permanent: true
        }));

        // 2. Save to DynamoDB
        const item = { student_id, name, dob, class: stuClass, section };
        await docClient.send(new PutCommand({
            TableName: T('Students'),
            Item: item
        }));

        res.json({ success: true, message: 'Student added' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

adminRouter.delete('/students/:id', async (req, res) => {
    try {
        // Delete from DDB
        await docClient.send(new DeleteCommand({
            TableName: T('Students'),
            Key: { student_id: req.params.id }
        }));
        // Note: also delete from Cognito User Pool in production
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use('/api/admin', adminRouter);

// ── STUDENT API ─────────────────────────────────────────────────────────────
studentRouter.get('/marks', async (req, res) => {
    // In a real app, extract student_id from token
    const student_id = 'STU2024001'; // Mock for now
    try {
        const result = await docClient.send(new QueryCommand({
            TableName: T('Marks'),
            KeyConditionExpression: 'student_id = :sid',
            ExpressionAttributeValues: { ':sid': student_id }
        }));
        res.json(result.Items || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use('/api/student', studentRouter);

// Basic health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'AWS Lambda DynamoDB backend active' });
});

// Export Serverless Handler
module.exports.handler = serverless(app);
