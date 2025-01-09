export const corsConfig = {
    origin: [
      "https://kinscare.org",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "https://kinscarev2.vercel.app",
      "https://kinscare.wm.r.appspot.com",
      "http://192.168.1.133:3001",
    ],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  };
  