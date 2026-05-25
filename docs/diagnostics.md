# Diagnostics & Error Mapping

This guide maps technical failure states to business impacts and troubleshooting steps.

| Technical State / Code | Business Meaning | Resolution |
|-------------------------|------------------|------------|
| `ADMIN_ACCESS not configured` | Server Security Risk | The `ADMIN_ACCESS` env variable is missing on the server. |
| `Contraseña incorrecta` | Unauthorized Admin Access | The password provided to enter the Admin Panel is invalid. |
| `Invalid email` | Access Denied (Domain) | The user's email domain is not in the allowed list. |
| `AWS credentials not configured` | S3 Integration Broken | AWS keys are missing; uploads and playback will fail. |
| `Failed to upload file` | S3 Write Error | Check S3 permissions, bucket name, or network connectivity. |
| `Failed to generate presigned URL` | Playback Error | The server cannot communicate with AWS to authorize a video view. |
| `the client is offline` | Connectivity Issue | The user's browser cannot reach Firebase services. |
| `Falta configurar CORS en S3` | S3 Browser Block | The S3 bucket lacks the CORS policy required for direct browser uploads. |
| `El título es obligatorio` | Data Validation | Frontend prevents saving a course without a title. |
| `Debes añadir al menos un capítulo` | Content Validation | Frontend prevents saving an empty course structure. |
