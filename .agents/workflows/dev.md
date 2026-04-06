---
description: How to start the full MeAI development stack locally
---

# MeAI Development Workflow

## Prerequisites
- Node.js 18+
- Gemini API key (free! → https://aistudio.google.com/apikey)

## Steps

### 1. Set up environment variables
```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

// turbo
### 2. Install backend dependencies
```bash
cd backend && npm install
```

### 3. Start the backend server
```bash
cd backend && npm run dev
```

### 4. Verify backend is running
```bash
curl http://localhost:8000/health
```

// turbo
### 5. Install mobile dependencies
```bash
cd mobile && npm install
```

### 6. Start the Expo development server
```bash
cd mobile && npx expo start
```

### 7. Test the full flow
- Open the Expo app on your phone or emulator
- Send a message in the chat
- Verify you get a response from MeAI
- Check the mood indicator changes based on your message

## Troubleshooting

### Backend won't start
- Check GEMINI_API_KEY is set in .env
- Get a free key at https://aistudio.google.com/apikey

### Mobile can't connect to backend
- On physical device: change `API_BASE_URL` in `mobile/src/services/api.ts` to your computer's local IP (e.g., `http://192.168.1.x:8000`)
- On iOS simulator: `http://localhost:8000` works
- On Android emulator: use `http://10.0.2.2:8000`
