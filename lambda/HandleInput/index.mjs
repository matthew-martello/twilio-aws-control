import {
  EC2Client,
  StartInstancesCommand,
  StopInstancesCommand,
} from "@aws-sdk/client-ec2";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const VOICE = process.env.VOICE;
const SERVER_WHITELIST = process.env.SERVER_WHITELIST.split(",");

const region = process.env.AWS_REGION;
const instanceId = process.env.INSTANCE_ID;

function parseTwilioBody(event) {
  const decoded = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  return Object.fromEntries(new URLSearchParams(decoded));
}

function unauthorized() {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/xml" },
    body: `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="${VOICE}">Unauthorized</Say>
      </Response>`,
  };
}

// XML Helpers
function xmlEscape(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twimlSay(text) {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="${VOICE}">${xmlEscape(text)}</Say>
      <Hangup/>
    </Response>`;
}

export const handler = async (event) => {
  console.log("VOICE:", VOICE);

  const params = parseTwilioBody(event);
  const digits = params.Digits; // <-- Key pressed
  const from = params.From;

  console.log("User pressed:", digits);

  const server_allowed = SERVER_WHITELIST.filter((c) => from == c);

  switch (digits) {
    case "1":
      if (server_allowed.length == 0) {
        return unauthorized();
      }

      return startServer(from);
      break;

    //Temporarily disable option two.
    // case "2":
    //   if (server_allowed.length == 0) {
    //     return unauthorized();
    //   }

    //   return stopServer(from);
    //   break;

    default:
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/xml" },
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Say voice="${VOICE}">Invalid option.</Say>
            <Hangup/>
          </Response>`,
      };
  }
};

const ec2 = new EC2Client({ region });
const lambda = new LambdaClient({ region });

async function startServer(from) {
  if (!instanceId) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/xml" },
      body: twimlSay("Could not start the server, missing instance ID."),
    };
  }

  try {
    const res = await ec2.send(
      new StartInstancesCommand({
        InstanceIds: [instanceId],
      })
    );

    const item = res.StartingInstances?.[0];
    const current = item?.CurrentState?.Name; // e.g. "pending" or "running"
    const previous = item?.PreviousState?.Name; // e.g. "stopped"

    let msg = "Server start request accepted.";
    if (current === "pending") msg = "Server is starting now.";
    if (current === "running" || previous === "running")
      msg = "Server is already running.";

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/xml" },
      body: twimlSay(msg),
    };
  } catch (err) {
    // Common case: already running / already in transition / wrong state
    if (err?.name === "IncorrectInstanceState") {
      notifyAdmin(from).catch(console.error);
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/xml" },
        body: twimlSay("Server is already running or is currently starting."),
      };
    }

    console.error("EC2 start failed:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/xml" },
      body: twimlSay("Failed to start the server. Please try again later."),
    };
  }
}

async function stopServer(from) {
  if (!instanceId) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/xml" },
      body: twimlSay("Could not stop the server, missing instance ID."),
    };
  }

  try {
    const res = await ec2.send(
      new StopInstancesCommand({ InstanceIds: [instanceId] })
    );

    const item = res.StoppingInstances?.[0];
    const current = item?.CurrentState?.Name; // e.g. "stopping"
    const previous = item?.PreviousState?.Name; // e.g. "running"

    let msg = "Server stop request accepted.";
    if (current === "stopping") msg = "Server is stopping now.";
    if (previous === "stopped" || current === "stopped")
      msg = "Server is already stopped.";

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/xml" },
      body: twimlSay(msg),
    };
  } catch (err) {
    // Common case: already stopped / not running
    if (err?.name === "IncorrectInstanceState") {
      notifyAdmin(from).catch(console.error);
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/xml" },
        body: twimlSay("Server is not currently running."),
      };
    }

    console.error("EC2 stop failed:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/xml" },
      body: twimlSay("Failed to stop the server. Please try again later."),
    };
  }
}
