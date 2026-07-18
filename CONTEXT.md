# ACED Fleet Man - Project Context

This file serves as a memory state and handoff document for AI assistants working on this project. If you are a new AI agent reading this, adhere strictly to the rules below.

## The Golden Rules (ACED Division Build Spec)
- **Target Host:** Namecheap cPanel — CloudLinux Passenger (Node.js).
- **Architecture:** Express/Mongoose API in `app.js` (single Node entry point, Passenger-compatible) serving a Next.js 14 frontend in `/frontend`. Legacy EJS views in `/views` are being phased out — see EJS Removal Plan for status; do not extend EJS with new pages.
- **Entry Point:** `app.js` is the single entry point. Passenger calls it directly.
- **Proxy:** `app.set('trust proxy', 1)` is CRITICAL and non-negotiable.
- **Rate Limiters:** DO NOT ADD RATE LIMITERS. They break behind Namecheap's proxy. Security is handled via Helmet, CORS, JWT, 2FA, and bcrypt.
- **Views:** Next.js (`/frontend`) is the active UI. Legacy EJS templates (`/views`, Tailwind via Play CDN, Blue & White theme) remain for now but are frozen — no new EJS pages, no EJS feature work. See EJS Removal Plan for the retirement process.
- **Data Layer:** MongoDB via Mongoose (`/models`).
- **Static Assets:** Served entirely from `/public`.
- **.htaccess:** Managed by Passenger. Ignored in `.gitignore`.

## What Has Been Built So Far
1. **Foundation:** 
   - `app.js` configured with Express, Mongoose, Helmet, Cors, and EJS.
   - `.env` setup with MongoDB and Cloudinary credentials.
2. **Data Models:**
   - `User.js`
   - `MaintenanceRequest.js` (with Cloudinary `photoUrl` field)
   - `Task.js`
   - `EveningWalkthrough.js`
3. **UI/Presentation:**
   - `views/components/header.ejs` (Tailwind Blue/White theme) & `footer.ejs`
   - `views/pages/index.ejs` (Landing/Login page)
   - `views/pages/dashboard.ejs` (Dashboard overview with links)
   - `views/pages/maintenance_new.ejs` (Maintenance request form with photo upload)
   - `views/pages/walkthrough_new.ejs` (Evening checklist form)
4. **Integrations:**
   - **MMR Generator:** Fully migrated to `services/mmr/`, converted to CommonJS. API endpoints (`/api/generate`, `/api/generate-batch`) injected into `app.js`.
   - **Cloudinary:** Integrated with `multer` to handle image uploads on the `/api/maintenance` route.

## Next Steps / Pending Features
- **Authentication:** Implement JWT + TOTP 2FA for the `/login` route.
- **Reporting Dashboards:** Build the views to display the submitted Maintenance Requests and Evening Walkthroughs.
- **Task Management:** UI for viewing and managing standard tasks.
