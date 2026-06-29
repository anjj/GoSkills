# Specification: Landing Page (Pre-Login Welcome Page)

## Overview
Create a public-facing landing page that serves as the entry point for the GoSkills platform before users log in. The primary goal of this page is to explain the product simply and effectively, positioning it as a "Udemy clone for corporate guides." It will educate internal employees and new hires on the platform's purpose before they authenticate.

## Functional Requirements
- **Hero Section**: A welcoming header introducing GoSkills with an engaging headline.
- **Product Explanation Section**: Clear, simple messaging explaining what GoSkills is (a corporate Udemy-like platform for internal video pills) and its main use cases.
- **Authentication Call-to-Action**: Include a clear pathway (e.g., a "Login" button) that directs users to the authentication flow.
- **Responsive Design**: Ensure the page looks great and functions properly on desktop, tablet, and mobile devices.

## Non-Functional Requirements
- **Aesthetics**: Must adhere to premium, minimalist web design guidelines using Tailwind CSS and Motion. The UI should be polished, using curated colors, modern typography, and subtle micro-animations to create a strong first impression.
- **Performance**: The page should load quickly and efficiently.

## Acceptance Criteria
- [ ] Unauthenticated users navigating to the root URL (`/`) see the new landing page.
- [ ] The landing page clearly explains the purpose of GoSkills (corporate knowledge sharing via video pills).
- [ ] A prominent "Login" button is present and functional, leading to the authentication flow.
- [ ] The design is fully responsive and matches the project's premium aesthetic standards.

## Out of Scope
- Post-login dashboard or course browsing features.
- Actual implementation of the authentication backend (only UI integration to the existing/planned auth flow is required).
