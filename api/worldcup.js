import { handleWorldcup, sendJson } from "./_shared.js";

export default async function handler(request, response) {
  try {
    await handleWorldcup(request, response);
  } catch (error) {
    sendJson(response, { error: error instanceof Error ? error.message : "Unexpected server error." }, 500);
  }
}
