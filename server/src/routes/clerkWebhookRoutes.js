import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";
import axios from "axios"; // Make sure to add axios as a dependency

const router = express.Router();

// Retrieve the secret from Azure App Service environment variables.
const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

// Optional: A URL to trigger your CI/CD pipeline (e.g., via Azure DevOps or GitHub Actions)
const CI_TRIGGER_URL = process.env.CI_TRIGGER_URL || "";

/**
 * Middleware: Use body-parser to capture the raw body.
 * This is necessary for validating the webhook signature.
 */
router.use(
    bodyParser.json({
        verify: (req, res, buf) => {
            req.rawBody = buf;
        },
    })
);

/**
 * Verify the webhook signature using HMAC SHA256 with the secret.
 * Returns true if the signature is valid.
 */
function verifySignature(req) {
    const signatureHeader = req.header("Clerk-Signature") || "";
    const computedSignature = crypto
        .createHmac("sha256", CLERK_WEBHOOK_SECRET)
        .update(req.rawBody)
        .digest("hex");
    return signatureHeader === computedSignature;
}

/**
 * Process the webhook event based on its type.
 * You can expand this function to integrate caching, session invalidation,
 * or trigger downstream services (like CI/CD).
 */
async function processWebhookEvent(event) {
    console.log("Processing Clerk webhook event:", event.type);

    switch (event.type) {
        case "user.created":
            // Process new user registration, update your database or cache as needed.
            console.log("New user created:", event.data);
            break;
        case "user.signed_in":
            // Optional: Warm up caches, update session states, or notify systems.
            console.log("User signed in:", event.data);
            break;
        case "session.ended":
            console.log("Session ended:", event.data);
            // If a CI/CD trigger URL is configured, send a POST request
            if (CI_TRIGGER_URL) {
                try {
                    const response = await axios.post(CI_TRIGGER_URL, { event });
                    console.log("Successfully triggered CI/CD pipeline:", response.data);
                } catch (error) {
                    console.error("Failed to trigger CI/CD pipeline", error);
                }
            }
            // Optionally: Invalidate caching related to the session here.
            break;
        default:
            console.log("Unhandled event type:", event.type);
            break;
    }
}

/**
 * Webhook route to process incoming Clerk events.
 * It verifies the signature and then processes the event.
 */
router.post("/", async (req, res) => { 
    // Verify the request's signature before any processing.
    if (!verifySignature(req)) {
        console.error("Invalid webhook signature");
        return res.status(401).json({ error: "Invalid signature" });
    }

    const event = req.body;

    try {
        await processWebhookEvent(event);
        return res.status(200).json({ received: true });
    } catch (error) {
        console.error("Error processing webhook event:", error);
        return res.status(500).json({ error: "Webhook processing failed" });
    }
});

export default router; // Ensure the router is exported as default
