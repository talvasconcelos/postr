<script>
  import { marked } from "marked";
  import { onMount } from "svelte";
  import {
    findPreviousPosts,
    publishToRelays,
    randomId,
    defaultRelays
  } from "./lib/nostr";

  let usingRelays = []
  let source = "";
  let markdown = "";
  let showPreview = true;
  let title, summary, image;
  let hasNIP07 = false;
  let previous = [];
  let previousPosts = new Map();
  let loading = false;
  let loadingPosts = false;

  function timeout(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  $: markdown = source && marked(source);
  $: previousPostID = null;

  async function initializeRelays() {
    let relays = Object.keys(((await window.nostr?.getRelays?.()) || []));
    if (relays.length === 0) relays = defaultRelays;

    let nip33 = [];
    for (let i = 0; i < relays.length; i++) {
      let url = relays[i];
      try {
        const req = await fetch(url.replace("wss://", "https://").replace('ws://', 'http://'), {
          headers: {
            Accept: "application/nostr+json"
          }
        });
        const res = await req.json();
        if (res.supported_nips.includes(33)) {
          nip33.push(url);
        }
      } catch (error) {
        continue;
      }
    }

    usingRelays = nip33;
  }

  function reset() {
    title = null;
    summary = null;
    image = null;
    source = null;
    previousPostID = null;
  }

  function handlePrevious(ev) {
    loadingPosts = true;
    let tagID = ev.tags.find(([k, v]) => k === "d" && v && v !== "")[1];
    if (!tagID) {
      loadingPosts = false;
      return;
    }
    //if it's in cache and older do nothing
    if (
      previousPosts.has(tagID) &&
      previousPosts.get(tagID).timestamp > ev.created_at
    ) {
      loadingPosts = false;
      return;
    }

    const data = Object.fromEntries(ev.tags)

    previousPosts.set(tagID, {
      timestamp: ev.created_at,
      content: ev.content,
      ...data
    });
    previous = [...Array.from(previousPosts.values())];
    loadingPosts = false;
  }

  function editPost(post) {
    console.log('editing', post);
    title = post.title;
    source = post.content;
    summary = post.summary || "";
    image = post.image || "";
    previousPostID = post.uuid;
  }

  async function publish() {
    loading = true;

    const tags = [
      ["d", previousPostID ? previousPostID : randomId()]
    ]

    if (title && title !== "") tags.push(["title", title])
    if (summary && summary !== "") tags.push(["summary", summary])
    if (image && image !== "") tags.push(["image", image])

    const event = {
      kind: 30023,
      pubkey: await window.nostr.getPublicKey(),
      content: source,
      created_at: Math.floor(Date.now() / 1000),
      tags
    };

    var signed
    try {
      signed = await window.nostr.signEvent(event);
    } catch (error) {
      loading = false
      console.error("failed to sign with extension", error)
      return
    }

    try {
      await publishToRelays(usingRelays, signed);
      await timeout(500);
      await getPreviousPosts();
      reset();
      loading = false;
    } catch (error) {
      loading = false;
      console.error("something went wrong", error);
    }
  }

  async function getPreviousPosts() {
    let pub = await window.nostr.getPublicKey();
    await findPreviousPosts(usingRelays, pub, (event) => {
      handlePrevious(event);
    });
  }
  onMount(async () => {
    await timeout(500);
    hasNIP07 = Boolean(window.nostr);
    if (!hasNIP07) return;
    await initializeRelays();
    await getPreviousPosts();
  });
</script>

<section>
  <div class="header">
    <hgroup>
      <h1>Postr</h1>
      <h3>
        <a
          href="https://github.com/nostr-protocol/nips/blob/master/23.md"
          target="_blank"
          rel="noopener noreferrer">nip23</a
        >-enabled article editor for Nostr
      </h3>
    </hgroup>
    {#if !hasNIP07}
      <small
        >You need to have a signing browser extension (<a
          href="https://github.com/nostr-protocol/nips/blob/master/07.md#nip-07"
          target="_blank"
          rel="noopener noreferrer">NIP07</a
        >) to use this tool</small
      >
    {/if}
  </div>
  <div class="grid">
    <details role="list">
      <summary
        aria-busy={loadingPosts}
        aria-haspopup="listbox">Previous Posts</summary
      >
      <ul role="listbox">
        {#if previous}
          {#each previous as post}
            <li><a on:click={() => editPost(post)}>{post.title}</a></li>
          {/each}
        {:else}
          <li>No posts found</li>
        {/if}
      </ul>
    </details>
    <div class="relays">
      Relays
      {#each usingRelays as relay}
        <div>{relay}</div>
      {/each}
    </div>
  </div>
  <div class="main grid">
    {#if hasNIP07}
      <div class="editor">
        <fieldset>
          <label for="switch">
            <input
              type="checkbox"
              id="switch"
              name="switch"
              role="switch"
              bind:checked={showPreview}
            />
            {showPreview ? "Show Preview" : "Hide Preview"}
          </label>
        </fieldset>
        <fieldset>
          <label for="title">Title</label>
          <input
            id="title"
            type="text"
            bind:value={title}
          />
        </fieldset>
        <div class="markdown-editor">
          <div class="left-panel">
            <label for="post">Write post</label>
            <textarea
              id="post"
              bind:value={source}
              placeholder="Markdown article body"
              class="source"
            />
            <br />
            <label for="summary">Summary</label>
            <textarea
              id="summary"
              placeholder="Summary"
              bind:value={summary}
            />
            <small>A small intro text (optional)</small>
          </div>
        </div>
        <label for="image">Hero Image</label>
        <input
          id="image"
          placeholder="https://images.unsplash.com/photo....."
          type="url"
          bind:value={image}
        />
        <small>A URL for the image (optional)</small>
        <a
          aria-busy={loading}
          on:click={publish}
          href="javascript:;"
          role="button">Publish</a
        >
      </div>
      {#if showPreview}
        <div class="preview">
          <hgroup><h3>Preview</h3></hgroup>
          <div class="output">{@html markdown}</div>
        </div>
      {/if}
    {:else}
      <p>Can't use this tool</p>
    {/if}
  </div>
  <footer>
    <hr />
    <p>
       <a
        href="https://github.com/talvasconcelos/postr"
        target="_blank"
        rel="noopener noreferrer">Source code</a
      >.
    </p>
  </footer>
</section>

<style>
  .header {
    margin-bottom: 3rem;
  }
  .header h1 {
    margin: 0;
  }
  .preview {
    margin-top: 3rem;
  }
  .relays {
    margin-bottom: 3rem;
  }
  .markdown-editor {
    margin-bottom: var(--form-element-spacing-vertical);
  }
  .source {
    min-height: 70vh;
  }

  @media only screen and (min-width: 992px) {
    .preview {
      margin-top: 0;
      border-left: var(--border-width) solid var(--form-element-border-color);
      padding-left: 1rem;
    }

    .relays {
      margin-left: 10px;
    }
  }
</style>
