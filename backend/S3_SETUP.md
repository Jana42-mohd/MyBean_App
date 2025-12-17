# S3 Integration for Profile Photos

## Overview
Profile photos are now stored in AWS S3 bucket `my-bean-storage-bucket` instead of local file system.

## AWS Credentials Setup

### Required Environment Variables
Add these to your backend server environment:

```bash
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
S3_BUCKET_NAME=my-bean-storage-bucket
```

### Creating AWS IAM User

1. **Go to AWS IAM Console**
   - Navigate to IAM → Users → Create User

2. **Create a new user for the application**
   - Username: `mybean-app-s3-user`
   - Select "Attach policies directly"

3. **Attach the following policy** (or create a custom one):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject"
         ],
         "Resource": "arn:aws:s3:::my-bean-storage-bucket/*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "s3:ListBucket"
         ],
         "Resource": "arn:aws:s3:::my-bean-storage-bucket"
       }
     ]
   }
   ```

4. **Create Access Keys**
   - Go to the user's Security Credentials tab
   - Create Access Key → Choose "Application running outside AWS"
   - Save the Access Key ID and Secret Access Key

## S3 Bucket Configuration

### Bucket Policy (for public read access)
To make profile photos publicly accessible:

1. Go to S3 bucket `my-bean-storage-bucket`
2. Navigate to Permissions → Bucket Policy
3. Add this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-bean-storage-bucket/profile-photos/*"
    }
  ]
}
```

### CORS Configuration
Add CORS rules to allow uploads from your frontend:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

## Deployment Steps

### Local Development
1. Create a `.env` file in the backend directory:
   ```
   AWS_ACCESS_KEY_ID=your_access_key_here
   AWS_SECRET_ACCESS_KEY=your_secret_key_here
   AWS_REGION=us-east-1
   S3_BUCKET_NAME=my-bean-storage-bucket
   ```

2. Update `server.js` to load environment variables:
   ```javascript
   require('dotenv').config();
   ```

3. Restart your backend server

### EC2 Deployment
Set environment variables on your EC2 instance:

```bash
export AWS_ACCESS_KEY_ID=your_access_key_here
export AWS_SECRET_ACCESS_KEY=your_secret_key_here
export AWS_REGION=us-east-1
export S3_BUCKET_NAME=my-bean-storage-bucket
```

Or add them to your PM2 ecosystem file:
```javascript
module.exports = {
  apps: [{
    name: 'mybean-backend',
    script: './server.js',
    env: {
      AWS_ACCESS_KEY_ID: 'your_access_key_here',
      AWS_SECRET_ACCESS_KEY: 'your_secret_key_here',
      AWS_REGION: 'us-east-1',
      S3_BUCKET_NAME: 'my-bean-storage-bucket'
    }
  }]
};
```

## Testing

1. **Test upload**: Use the app to upload a profile photo
2. **Verify in S3**: Check the S3 bucket for the uploaded file
3. **Test display**: Ensure the photo displays correctly in the app
4. **Test delete**: Delete a photo and verify it's removed from S3

## Migration from Local Storage

If you have existing users with local profile photos, you'll need to migrate them to S3:

1. List all users with local photos:
   ```sql
   SELECT id, profile_photo FROM users WHERE profile_photo LIKE '/uploads/%';
   ```

2. Upload each photo to S3 and update the database
3. Delete local files after successful migration

## Troubleshooting

- **Upload fails**: Check AWS credentials and IAM permissions
- **Photos not displaying**: Verify bucket policy allows public read
- **CORS errors**: Check CORS configuration in S3 bucket
- **403 errors**: Check IAM user has correct permissions

## Security Notes

- Never commit AWS credentials to version control
- Use environment variables for all sensitive data
- Consider using AWS IAM roles if running on EC2
- Implement file size limits (currently set to 5MB)
- Validate file types before upload
