import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: "10mb" }));

// Lazy init of GoogleGenAI
let ai: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARN: GEMINI_API_KEY environment variable is not defined.");
    }
    ai = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return ai;
}

// 1. AI Symptom Checker API Route
app.post("/api/gemini/symptoms", async (req, res) => {
  try {
    const { message, chatHistory } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Symptom message is required" });
    }

    const genAI = getGenAI();
    
    // If API key is missing, mock a beautiful doctor-like response
    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        reply: `Hello! I would be happy to help. Although the AI server is currently running in a simulated mode without an active API key, here is helpful general info regarding: "${message}". Please consult a doctor immediately if you experience severe symptoms like chest pain or shortness of breath. Based on typical patterns of these symptoms, we recommend consulting our **General Practitioner** or a **Cardiologist**.`,
        department: "Cardiologist",
        conditions: ["Mild fatigue", "Seasonal updates"],
        urgency: "Medium",
        isMock: true,
      });
    }

    const systemInstruction = `You are EliteCare's premium AI Medical Symptom Checker. 
Provide a warm, empathetic, and highly professional assessment. 
Include:
1. An analysis of the possible causes/conditions.
2. A recommended medical specialist department of EliteCare (e.g., "Cardiologist", "Neurologist", "Dermatologist", "Pediatrician", "Orthopedic", "Gynecologist", "General Practitioner"). Match one of these names exactly if applicable!
3. Guidance/Home remedies and smart health actions.
4. Urgency level ('Low', 'Medium', 'High') and a prominent medical disclaimer.

Structure the response as clean HTML or easy-to-parse Markdown. Ensure you deliver a highly-polished clinical report style.`;

    const response = await genAI.models.generateContent({
      model: "gemini-3.5-flash",
      contents: message,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const replyText = response.text || "Unable to formulate a response at this moment. Please rephrase your symptoms.";
    
    // Extract recommended department for mapping doctors
    let department = "General Practitioner";
    const lowercaseReply = replyText.toLowerCase();
    if (lowercaseReply.includes("cardio") || lowercaseReply.includes("heart")) {
      department = "Cardiologist";
    } else if (lowercaseReply.includes("neuro") || lowercaseReply.includes("brain") || lowercaseReply.includes("nerve")) {
      department = "Neurologist";
    } else if (lowercaseReply.includes("derm") || lowercaseReply.includes("skin") || lowercaseReply.includes("rash")) {
      department = "Dermatologist";
    } else if (lowercaseReply.includes("pediatr") || lowercaseReply.includes("child") || lowercaseReply.includes("baby")) {
      department = "Pediatrician";
    } else if (lowercaseReply.includes("ortho") || lowercaseReply.includes("bone") || lowercaseReply.includes("joint") || lowercaseReply.includes("muscle")) {
      department = "Orthopedic";
    } else if (lowercaseReply.includes("gyne") || lowercaseReply.includes("pregnancy") || lowercaseReply.includes("female")) {
      department = "Gynecologist";
    }

    let urgency = "Medium";
    if (lowercaseReply.includes("urgent") || lowercaseReply.includes("emergency") || lowercaseReply.includes("immediate") || lowercaseReply.includes("high urgency")) {
      urgency = "High";
    } else if (lowercaseReply.includes("low urgency") || lowercaseReply.includes("mild") || lowercaseReply.includes("home care")) {
      urgency = "Low";
    }

    res.json({
      reply: replyText,
      department,
      urgency,
    });
  } catch (error: any) {
    console.error("Error in Symptom Checker API:", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

// 2. Medicine Scanner / Drug Info API Route
app.post("/api/gemini/scan-med", async (req, res) => {
  try {
    const { medicineName, notes } = req.body;
    if (!medicineName) {
      return res.status(400).json({ error: "Medicine name or image scan metadata is required" });
    }

    const genAI = getGenAI();

    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        analysis: `### **${medicineName}** - Analysis Summary
* **Classification**: Simulated medication profile.
* **Primary Uses**: Information reference on active therapeutic ingredients.
* **Standard Dosage**: Refer to packaging or consultant recommendations.
* **Side Effects**: Nausea, mild drowsiness.
* **Disclaimer**: This is a mock response because the Gemini API Key is not configured.`,
        isMock: true,
      });
    }

    const response = await genAI.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Provide a structured medical analysis for the medicine: "${medicineName}". Include additional comments: "${notes || "none"}".
Format output in elegant markdown structure:
1. **Classification** (What category does the drug belong to)
2. **Primary Medical Indications** (What it is used to treat)
3. **Recommended Usage & Dosage**
4. **Common & Severe Side Effects**
5. **Critical Safety Warnings & Drug Interactions**
6. **Smart Daily Reminders**`,
      config: {
        systemInstruction: "You are an EliteCare Pharmacist Consultant. Deliver precise, readable prescription drug facts.",
        temperature: 0.2,
      },
    });

    res.json({
      analysis: response.text || "No medication metadata generated.",
    });
  } catch (error: any) {
    console.error("Error in Medicine Scanner API:", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

// 3. General Health chatbot Assistant API Route
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { message, chatHistory } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Query message is required" });
    }

    const genAI = getGenAI();

    if (!process.env.GEMINI_API_KEY) {
      // Return smart dynamic patient support answers
      const lower = message.toLowerCase();
      let responseMock = `I'm here to provide premium care info. Let me know how I can guide your EliteCare health portal experience.`;
      if (lower.includes("hello") || lower.includes("hi")) {
        responseMock = `Hello! I am your EliteCare Resident Health Assistant. How can I assist you with your health logs, symptom records, or appointment bookings today?`;
      } else if (lower.includes("appointment") || lower.includes("doctor")) {
        responseMock = `To schedule an appointment, you can navigate to the **Find Doctor** tab. We have specialized Doctors in Cardiology, Neurology, Dermatology, Orthopedics, Gynecologists, and our brand new **Eye Specialist** department!`;
      } else if (lower.includes("emergency") || lower.includes("accident") || lower.includes("alert")) {
        responseMock = `⚠️ **EMERGENCY DETECTED**: If you are facing a critical medical issue, please tap the red **EMERGENCY ASSIST** button immediately or visit our newly added **Emergency Alert** dashboard. Dial our medical unit at +1 (555) 901-4000.`;
      } else if (lower.includes("fee") || lower.includes("cost")) {
        responseMock = `Our consulting fees are structured by specialty: Cardiologist ($120), Neurologist ($115), Pediatry ($85), Dermatology & Eye Specialist ($95), and general care ($90).`;
      } else if (lower.includes("symptom") || lower.includes("pain") || lower.includes("sick")) {
        responseMock = `I see you are experienced some discomfort. You can log symptoms in real-time on our **Symptom Log** page, which helps track status over time and suggests suitable departments. Let me know what symptoms you are tracking!`;
      }
      return res.json({ reply: responseMock, isMock: true });
    }

    // Prepare message structures with context
    const contents = [];
    if (chatHistory && Array.isArray(chatHistory)) {
      for (const turn of chatHistory.slice(-6)) { // Take last 6 history items for token safety
        contents.push({
          role: turn.role === "user" ? "user" as const : "model" as const,
          parts: [{ text: turn.text }]
        });
      }
    }
    contents.push({
      role: "user" as const,
      parts: [{ text: message }]
    });

    const response = await genAI.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: `You are EliteCare's premium Interactive Health Assistant. 
You reside on every page, helping patients manage scheduling, clinical diagnostic pathways, symptom logging, medicines scanning, and local guidelines.
Always keep answers friendly, elite, encouraging, and clear. Avoid dry blocky texts; use elegant formatting. 
Incorporate badging and micro-tips with badges or gamification concepts if users ask about earning coins or completing actions!`,
        temperature: 0.5,
      }
    });

    res.json({ reply: response.text || "I apologize, let's rephrase that query please." });
  } catch (error: any) {
    console.error("Error in Chatbot Assistant API:", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

// Serve health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
});

// Start listening and configuring Vite dev server / production files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up Vite middleware for development...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving production build from dist folder...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EliteCare Express/Vite server running on http://localhost:${PORT}`);
  });
}

startServer();
