# Security Specification - GoSkills

## Data Invariants
1. **Users**: Only the account owner can modify their profile. Emails are immutable set at creation.
2. **Courses**: Only verified admins can create, update, or delete courses. Any signed-in user can read courses.
3. **Progress**: Only the account owner can read or write their own progress data for a course.
4. **Admins**: Verification of admin status is managed via a dedicated `admins` collection and a bootstrapped master email.

## The "Dirty Dozen" Payloads (Denial Expected)

1. **Identity Spoofing (User Profile)**: Authenticated User A tries to create/update User B's profile.
2. **Privilege Escalation**: Authenticated non-admin user tries to create a course.
3. **Shadow Update (Course)**: Admin tries to update a course with a "isPromoted" field not in schema.
4. **Orphaned Progress**: User tries to save progress for a non-existent course ID (size/regex check).
5. **ID Poisoning**: User tries to create a course with a 1MB string as the document ID.
6. **Fake Timestamp**: Admin tries to set `createdAt` to a date in the past instead of `request.time`.
7. **Large Payload Attack**: User tries to save a 500KB string in the user `displayName`.
8. **PII Leak**: Non-admin user tries to list all user documents (PII isolation).
9. **Course Catalog Corruption**: User tries to delete a course.
10. **Malicious Chapter Injection**: Admin tries to add 500 chapters to a course (DDoS).
11. **Type Confusion**: Admin tries to set `chapters` to a string instead of a list.
12. **Recursive Cost Attack**: Unauthenticated user tries to list courses.

## Test Strategy
We will use a test runner to verify that all these malicious patterns are blocked.
