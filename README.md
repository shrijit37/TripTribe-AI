# TripTribe

TripTribe is a travel itinerary generator web application. Users can enter their destination, budget, and trip duration to receive a personalized travel plan.

## Features

- User authentication (signup, login, logout)
- Personalized itinerary generation based on city, budget, and days
- Responsive frontend built with React and Vite
- Backend API built with Express.js and MongoDB
- Google Places Autocomplete for city input

## Getting Started

### Prerequisites

- Node.js (v16+)
- Docker & Docker Compose (for containerized setup)
- MongoDB (local or cloud)
- Google Cloud API key (for Places Autocomplete)

### Local Development

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd TripTribe - upgraded
   ```

2. **Environment Variables:**
   - Create `.env` files for both frontend and backend as needed.
   - Backend should have MongoDB URI and JWT secret.

3. **Start with Docker Compose:**
   ```bash
   docker-compose up --build
   ```
   - Frontend: [http://localhost:5173](http://localhost:5173)
   - Backend: [http://localhost:8080](http://localhost:8080)

4. **Or run manually:**
   - Backend:
     ```bash
     cd backend
     npm install
     npm start
     ```
   - Frontend:
     ```bash
     cd frontend
     npm install
     npm run dev
     ```

## Deployment

- Backend can be deployed to Google Cloud Run or Render.
- Frontend can be deployed to Vercel, Netlify, or similar.
- Update API URLs and CORS settings for production.

## Configuration

- **CORS:** Ensure backend allows requests from your frontend domain and local IPs.
- **API URLs:** Use absolute URLs for production, and configure Vite proxy for local development if needed.

## Troubleshooting

- **CORS errors:** Update backend CORS config to include your frontend's origin.
- **Network errors:** Ensure backend is accessible from the device/browser making requests.
- **Google Places:** Make sure your API key is valid and enabled for Places API.

## License

MIT

