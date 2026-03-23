# Jeux de Typo V2

Interactive typographic learning experience built with Next.js (App Router), React, and GSAP.

## Development

Run the local server:

```bash
npm run dev
```

Then open `http://127.0.0.1:3000`.

## Commands

- `npm run dev`: start local development server on port 3000.
- `npm run lint`: run ESLint checks.
- `npm run typecheck`: run TypeScript checks.
- `npm run quality`: run the internal non-regression quality suite.
- `npm run build`: production build.
- `npm run start`: run production server.

## Project Structure

- `app/`: app router entry files and global styles.
- `components/blocks`: section-level UI blocks (including Gate sequence).
- `components/ui`: reusable UI primitives.
- `content/`: centralized copy constants.
- `docs/`: implementation notes and product constraints.

## Notes

- Motion timing, trigger boundaries, and layout hierarchy are behavior-critical.
- Build requires network access to fetch the Google Inter font via `next/font/google`.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
