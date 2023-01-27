import { relayInit } from "nostr-tools";

export const defaultRelays = new Map([
  ["wss://relay.nostr.info", { read: true, write: true }],
  ["wss://nostr.bitcoiner.social", { read: true, write: true }],
  //   ["wss://relay.damus.io", { read: true, write: true }],
  //   ["wss://nostr-pub.wellorder.net", { read: true, write: true }],
  //   ["wss://nostr-verified.wellorder.net", { read: true, write: true }],
  //   ["wss://expensive-relay.fiatjaf.com", { read: true, write: true }],
  //   ["wss://relay.nostrich.de", { read: true, write: true }],
  ["wss://nostr-pub.semisol.dev", { read: true, write: true }]
  //   ["wss://nostr.openchain.fr", { read: true, write: true }],
  //   ["wss://nostr.cercatrova.me", { read: true, write: true }]
]);

export async function checkSupportNIP33(relays) {
  let nip33 = [];
  for (const [url, _] of relays) {
    try {
      const req = await fetch(url.replace("wss://", "https://"), {
        headers: {
          Accept: "application/nostr+json"
        }
      });
      const res = await req.json();
      if (res.supported_nips.includes(33)) {
        nip33.push(url);
      }
    } catch (error) {
      console.error(error);
    }
  }
  return nip33;
}

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
        kinds: [33333],
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
