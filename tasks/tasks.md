# AWS Manual Setup Procedures

This document outlines the step-by-step manual procedures required to provision the AWS resources for the Adarsha Portal backend migration. Follow these steps meticulously, as they set up the cloud infrastructure your code will depend on.

## 1. AWS RDS (Relational Database Service) - MySQL

Your application uses a relational database schema. We are migrating from local SQLite to AWS RDS MySQL.

### Procedure:
1. Log in to the AWS Management Console and navigate to **RDS**.
2. Click **Create database**.
3. Choose **Standard create** and select the **MySQL** engine.
4. Select the appropriate Engine version (e.g., MySQL 8.0).
5. Choose **Free tier** or **Dev/Test** template depending on your budget.
6. Under Settings:
   - **DB instance identifier**: `adarsha-db`
   - **Master username**: `admin`
   - **Master password**: Choose a strong password and save it!
7. Under Instance configuration, you can leave it at `db.t3.micro`.
8. Under Connectivity:
   - Set **Publicly accessible** to **Yes** ONLY if you need to connect from your local machine during development (otherwise No for production, but you must set up VPC peering/VPN). For ease of development, you might set it to Yes, but secure the Security Group.
   - Create a new VPC security group naming it `adarsha-db-sg`.
9. Expand **Additional configuration**:
   - **Initial database name**: `adarsha`
   - Uncheck "Enable automated backups" if you are purely testing to save costs, otherwise leave it on.
10. Click **Create database**. It will take a few minutes.
11. **Post-creation**: Once "Available", click on the database instance and copy the **Endpoint** URL. Wait until the status is Available.

## 2. AWS Cognito User Pool (Authentication)

We are replacing your custom OTP login with AWS Cognito.

### Procedure:
1. Navigate to the **Cognito** service in the AWS Console.
2. Click **Create user pool**.
3. **Step 1:** Configure sign-in experience
   - Check **Username** or **Email** (if users will log in with email/username). For school IDs (e.g., `STU2024001`), choose **Username**.
   - Keep "Require username" checked.
4. **Step 2:** Configure security requirements
   - Password policy: Choose Cognito defaults or custom (min length 8).
   - Multi-factor authentication (MFA): Set to **No MFA** (as requested: "otp is not required").
   - User account recovery: Check "Email only".
5. **Step 3:** Configure sign-up experience
   - Self-registration: **uncheck** this box (school admins create accounts, not users).
   - Required attributes: Check `email` and perhaps `name`.
6. **Step 4:** Configure message delivery
   - Choose "Send email with Cognito" for basic testing (has quotas).
7. **Step 5:** Integrate your app
   - User pool name: `AdarshaUserPool`
   - Check "Use the Cognito Hosted UI" (optional, but we will likely use APIs, so you can leave it unchecked if using custom frontend).
   - **Initial app client**: Name it `AdarshaWebClient`.
   - Ensure "Generate a client secret" is **UNCHECKED** (critical for frontend JS apps).
   - Uncheck SRP if you just want to use basic Admin Initiate Auth for migration, though standard USER_PASSWORD_AUTH is needed.
8. Click **Create user pool**.
9. **Save**: Copy the **User Pool ID** and **App Client ID**.

## 3. AWS S3 Bucket (For Photos/Uploads)

### Procedure:
1. Navigate to the **S3** service.
2. Click **Create bucket**.
3. **Bucket name**: e.g., `adarsha-portal-uploads-YOUR_INITIALS` (must be globally unique).
4. **AWS Region**: Select your nearest region.
5. **Object Ownership**: ACLs disabled (recommended).
6. **Block Public Access settings**: 
   - Uncheck "Block all public access" if you want profile pictures to be public read.
   - Acknowledge the warning.
7. Click **Create bucket**.
8. **Permissions**: Go to the bucket's Permissions tab and add a Bucket Policy to allow `s3:GetObject` publicly:
   ```json
   {
       "Version": "2012-10-17",
       "Statement": [
           {
               "Sid": "PublicReadGetObject",
               "Effect": "Allow",
               "Principal": "*",
               "Action": "s3:GetObject",
               "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
           }
       ]
   }
   ```
   *(Replace YOUR-BUCKET-NAME)*

## 4. Required `.env` File Updates

Once you have created these resources, create/update your `.env` file in the frontend/backend with the following keys:

```env
# Database (RDS)
DB_HOST=your-rds-endpoint.us-east-1.rds.amazonaws.com
DB_USER=admin
DB_PASS=your_master_password
DB_NAME=adarsha

# Cognito Auth
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxx

# S3
S3_BUCKET_NAME=adarsha-portal-uploads-xxxx
AWS_ACCESS_KEY_ID=your_iam_user_access_key
AWS_SECRET_ACCESS_KEY=your_iam_user_secret_key

# Application
PORT=3000
```

*Note: You will need to create an IAM User with S3 upload permissions and generate an Access Key for the backend to handle file uploads to S3.*
