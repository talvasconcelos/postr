import { relayInit } from "nostr-tools";

export const defaultRelays = [
  "wss://nostr-relay.untethr.me",
  "wss://nostr.bg",
  "wss://nostr-pub.wellorder.net",
  "wss://nostr-pub.semisol.dev",
  "wss://eden.nostr.land",
  "wss://nostr.mom",
  "wss://nostr.fmt.wiz.biz",
  "wss://nostr.zebedee.cloud",
];

export async function publishToRelays(relays, event) {
  for (const url of relays) {
    const relay = relayInit(url);
    await relay.connect();

    relay.on("connect", () => {
      console.log(`connected to ${relay.url}`);
    });
    relay.on("error", () => {
      console.log(`failed to connect to ${relay.url}`);
    });
    //publish event
    let pub = relay.publish(event);
    pub.on("ok", () => {
      console.log(`${relay.url} has accepted our event`);
    });
    pub.on("seen", () => {
      console.log(`we saw the event on ${relay.url}`);
      relay.close();
    });
    pub.on("failed", (reason) => {
      console.log(`failed to publish to ${relay.url}: ${reason}`);
      relay.close();
    });
  }
}

export async function findPreviousPosts(relays, pubkey, cb) {
  for (const url of relays) {
    const relay = relayInit(url);
    await relay.connect();

    relay.on("connect", () => {
      console.log(`connected to ${relay.url}`);
    });
    relay.on("error", () => {
      console.log(`failed to connect to ${relay.url}`);
    });

    let sub = relay.sub([
      {
        kinds: [30023],
        authors: [pubkey]
      }
    ]);

    sub.on("event", (event) => {
      // console.log("we got the event we wanted:", event);
      cb(event);
    });

    sub.on("eose", () => {
      console.log("we've reached the end");
      sub.unsub();
    });
  }
}

export function randomId() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  ).slice(0, 8);
}
