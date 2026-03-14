# Adarsha Portal AWS Serverless Setup Guide

This guide provides the exact steps required to set up the AWS Serverless architecture for the Adarsha Portal. This architecture uses **Amazon Cognito** for authentication, **Amazon DynamoDB** for the database, **AWS Lambda** for the backend logic, and **Amazon API Gateway** for routing.

## 1. Amazon Cognito Setup (Authentication)

We will use Amazon Cognito User Pools for authenticating students, parents, teachers, and admins. Users will log in with a unique ID (Student ID, Parent ID, etc.) and a password. **Users cannot sign up themselves.** The Admins will create the users.

### Steps:
1. Open the **Amazon Cognito** console.
2. Click **Create user pool**.
3. **Configure sign-in experience**:
   - Provider types: **Cognito user pool**.
   - Cognito user pool sign-in options: **Preferred username** (to allow `STU...`, `PAR...`, `FAC...`, `ADMIN...` as IDs).
4. **Configure security requirements**:
   - Password policy: Choose your preferred policy (e.g., Cognito defaults).
   - Multi-factor authentication (MFA): **No MFA** (or Optional if required).
   - User account recovery: Disable self-service account recovery (since admins manage it).
5. **Configure sign-up experience**:
   - Self-registration: **Disable self-registration**. (Only admins can create users).
   - Allow Cognito to automatically send messages to verify and confirm: No.
6. **Configure message delivery**:
   - Choose **Send email with Cognito**.
7. **Integrate your app**:
   - App client name: `AdarshaPortalClient`.
   - Hosted UI: Don't check.
8. Review and **Create user pool**.
9. **Important**: Note the `User Pool ID` and the `App Client ID`. Put these into the `.env` file (`COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID`).

---

## 2. Amazon DynamoDB Setup (Database)

Create the following DynamoDB tables. Ensure that you place your table prefix (if configured in `.env`, e.g., `adarsha_`) before the table names.

**Note:** For all tables, set the Partition Key to **String** unless specified otherwise.

| Table Name | Partition Key | Sort Key (Optional) |
|------------|---------------|-----------------------|
| `Students` | `student_id` (String) | |
| `Parents` | `parent_id` (String) | |
| `Faculty` | `teacher_id` (String) | |
| `Admins` | `admin_id` (String) | |
| `Subjects` | `id` (String) | |
| `Marks` | `student_id` (String) | `exam_type#subject_id` (String) |
| `Attendance` | `date` (String) | `student_id` (String) |
| `Timetable` | `class#section` (String)| `day#period` (String) |
| `CalendarEvents` | `id` (String) | |
| `ExamSchedule` | `class` (String) | `subject_id` (String) |
| `Fees` | `student_id` (String) | `id` (String) |
| `LeaveRequests` | `id` (String) | |
| `Complaints` | `id` (String) | |
| `Classes` | `class_id` (String) | |
| `TeacherAssignments` | `faculty_id` (String) | `class_id#section` (String) |
| `Syllabus` | `class_id` (String) | `subject_id` (String) |

Ensure the capacity mode is set to **On-Demand** to save costs during development/low-traffic periods.

---

## 3. AWS Lambda and API Gateway Setup (Backend API)

We will deploy the entire `backend/` directory as a single Lambda function handling all HTTP traffic, routed via API Gateway. 

### IAM Execution Role for Lambda
First, create a role for the Lambda function:
1. Go to **IAM** -> **Roles** -> **Create Role**.
2. Select **AWS Service** -> **Lambda**.
3. Attach policies:
   - `AWSLambdaBasicExecutionRole`
   - `AmazonDynamoDBFullAccess`
   - `AmazonCognitoPowerUser` (to allow the backend to use `AdminCreateUser`)
4. Name the role `AdarshaPortalLambdaRole` and save.

### Creating the Lambda Function
1. Go to **AWS Lambda** -> **Create function**.
2. Choose **Author from scratch**.
3. Name: `AdarshaPortalBackend`.
4. Runtime: **Node.js 20.x**.
5. Architecture: **x86_64** (or arm64).
6. Execution role: Use existing role `AdarshaPortalLambdaRole`.
7. Click **Create function**.

### Uploading the Code
1. Locally, zip the contents of the `backend/` directory (make sure you install `npm install` inside `backend/` first to get all node modules).
2. Upload the `.zip` file via the Lambda console.
3. In the Lambda **Configuration -> Environment variables**, add all the variables from your local `.env`.

### Setting up API Gateway
1. Go to **API Gateway** -> **Create API**.
2. Select **HTTP API** -> **Build**.
3. **Integrations**: Choose **Lambda**, and select your `AdarshaPortalBackend` function.
4. Name the API: `AdarshaPortalAPI`.
5. **Configure routes**:
   - Method: `ANY`
   - Resource path: `/{proxy+}`
   - Integration target: `AdarshaPortalBackend`
6. Click **Next** until created.
7. Note the **Invoke URL** (Base API URL) and add it to `.env` as `BASE_API_URL`.

---

## 4. Hosting the Frontend on AWS Amplify

1. Go to the **AWS Amplify** console.
2. Choose **Host web app** (Amplify Hosting).
3. Connect your Git repository, or choose **Deploy without Git provider** (to upload the `public/`, `js/`, and `css/` folders in a zip).
4. **Important**: Before zipping your frontend, ensure that `API_BASE_URL` is set globally, or hardcode your `BASE_API_URL` into `js/utils.js` so it knows where to send requests.
5. Deploy.

Your Serverless Adarsha Portal is now fully live!
