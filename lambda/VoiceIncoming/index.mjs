function parseFormUrlEncodedFromEvent(event) {
  const body = event?.body || "";
  const decoded = event?.isBase64Encoded
    ? Buffer.from(body, "base64").toString("utf8")
    : body;
  return Object.fromEntries(new URLSearchParams(decoded));
}

function withQueryParam(url, key, value) {
  try {
    const u = new URL(url);
    u.searchParams.set(key, value);
    return u.toString();
  } catch {
    // If URL constructor fails (e.g. relative URL), fall back to naive append
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
}

export const handler = async (event) => {
  console.log("event:", JSON.stringify(event, null, 2));

  const handleInputUrl = process.env.HANDLE_INPUT_URL;
  console.log("Handle Input URL:", handleInputUrl);

  // Extract caller number (From) from Twilio's inbound webhook body and pass
  // to recording-status as a query string
  let from = null;

  try {
    const params = parseFormUrlEncodedFromEvent(event);
    from = params?.From || params?.Caller || null;
  } catch (e) {
    console.warn("Failed to parse inbound Twilio params:", e);
  }

  //Default Text to Speech voice
  const VOICE = process.env.VOICE;

  let START_SERVER = "";

  const SERVER_WHITELIST = process.env.SERVER_WHITELIST.split(",") || "";
  const allowed = SERVER_WHITELIST.filter((s) => from == s);

  let twiml = `<?xml version="1.0" encoding="UTF-8"?>`;

  if (allowed.length == 1) {
    twiml += `
      <Response>
        <Gather
          input="dtmf"
          numDigits="1"
          timeout="30"
          action="${handleInputUrl}"
        >
          <Say voice="${VOICE}">
            To start the server, press one.
          </Say>
        </Gather>
      </Response>`;

    //Temporarily disable option two.
    //To stop the server, press two.
  } else {
    // Caller unauthorised
    twiml += `<Response>
        <Say voice="${VOICE}">
          Unauthorised
        </Say>
      </Response>
      `;
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/xml" },
    body: twiml,
  };
};
