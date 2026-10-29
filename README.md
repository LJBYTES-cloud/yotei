# Yotei Engine

Yotei Engine is a mobile study management system built with React Native and Expo. It is designed to help students organize academic responsibilities, mitigate procrastination, and prevent burnout through commitment-based scheduling and rule-based behavioral coaching.

The project is built on a local-first architecture, ensuring that all academic data remains private and accessible offline on the user's device.

## Core Features

*   **Commitment Scheduler:** Converts academic tasks into scheduled study blocks with custom durations and native date/time selection.
*   **Anti-Burnout Guardrail:** Intercepts the scheduling process if a user attempts to plan more than 240 minutes (4 hours) of study in a single day, prompting them to reconsider their workload.
*   **Focus Timer:** Tracks actual wall-clock study time versus break time, persisting timing data to the local database to prevent data loss if the app is backgrounded.
*   **Rule-Based Coach:** A deterministic rule engine that queries local data to provide actionable feedback. For example, it surfaces a "5-minute start" prompt if a user has postponed a specific task multiple times, or warns of overdue deadlines.
*   **Study Journal:** A chronological timeline where users can manually log their thoughts or automatically record reflections immediately after completing a Focus Session.
*   **Bookshelf Library:** An interactive UI that groups subjects by Field of Study. Subjects are displayed as books with distinct color gradients, allowing users to manage tasks and attached study materials (file references or URLs).
*   **Data Portability:** Export and import the entire SQLite database as a JSON file for manual backups or device migration.

## Technology Stack

*   **Framework:** React Native with Expo (SDK 57)
*   **Local Storage:** `expo-sqlite`
*   **Authentication:** Appwrite Cloud (`react-native-appwrite`)
*   **Navigation:** Expo Router
*   **Data Visualization:** `react-native-chart-kit`
*   **Testing:** Node.js (`node:test` and `node:sqlite`)

## Architecture Overview

Yotei Engine uses an adapter pattern for authentication. The app can switch between `MockAuthService` (for offline development and testing) and `AppwriteAuthService` (for production). 

All academic data (tasks, schedules, journals) is stored locally in SQLite. Every table includes a `user_id` column, and all database queries are strictly scoped to the currently authenticated user. Appwrite is used exclusively for identity management and does not sync the academic data.

## Local Development Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/LJBYTES-cloud/yotei.git
    cd yotei
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Configuration:**
    Open `appwriteConfig.js` and populate the endpoint, project ID, and platform identifier for your Appwrite Cloud project.

4.  **Start the development server:**
    ```bash
    npx expo start -c
    ```
    Scan the generated QR code using the Expo Go application on a physical Android or iOS device.

## Building for Production (Android APK)

This project uses EAS Build to generate standalone Android packages.

```bash
npx eas-cli@latest build --platform android --profile preview