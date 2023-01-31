<script>
  import matter from "gray-matter";
  import { marked } from "marked";
  import slugify from "slugify";
  import { onMount } from "svelte";
  import {
    checkSupportNIP33,
    defaultRelays,
    findPreviousPosts,
    publishToRelays,
    uuidv4
  } from "./lib/nostr";
  let source = "";
  let markdown = "";
  let showPreview = true;
  let draft = true;
  let title, excerpt, hero;
  let hasNIP07 = false;
  let previous = [];
  let previousPosts = new Map();
  let loading = false;
  let loadingPosts = false;

  function timeout(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  async function getSupportedRelays() {
    const userRelays = (await window.nostr?.getRelays?.()) || [];
    const relays = defaultRelays;
    for (const key in userRelays) {
      relays.set(key, userRelays[key]);
    }

    return await checkSupportNIP33(relays);
  }

  $: markdown = source && marked(source);
  $: previousPostID = null;

  function reset() {
    title = null;
    excerpt = null;
    hero = null;
    source = null;
    draft = true;
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

    let { data, content } = matter(ev.content);
    if (!data.uuid) {
      loadingPosts = false;
      return;
    }
    previousPosts.set(tagID, {
      timestamp: ev.created_at,
      content,
      ...data
    });
    previous = [...Array.from(previousPosts.values())];
    loadingPosts = false;
  }

  function editPost(event) {
    console.log(event);
    title = event.title;
    source = event.content;
    excerpt = event.excerpt || "";
    hero = event.hero || "";
    draft = event.draft;
    previousPostID = event.uuid;
    // let post = matter(event);
    // title = post.data.title;
    // source = post.content;
    // excerpt = post.data.excerpt || "";
    // hero = post.data.hero || "";
    // draft = post.data.draft;
    // previousPostID = post.data.uuid ? post.data.uuid : uuidv4();
  }

  async function handlePost() {
    loading = true;
    const supportedRelays = await getSupportedRelays();
    const frontmatter = `---\ntitle: "${title}"\nslug: "${
      title && slugify(title.toLowerCase())
    }"\nexcerpt: "${excerpt}"\nhero: ${hero}\ndraft: ${draft}\nuuid: ${
      previousPostID ? previousPostID : uuidv4()
    } \n---\n`;
    const data = frontmatter + source;

    const event = {
      kind: 33333,
      pubkey: await window.nostr.getPublicKey(),
      content: data,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["d", previousPostID ? previousPostID : uuidv4()]]
    };
    const signed = await window.nostr.signEvent(event);
    try {
      await publishToRelays(supportedRelays, signed);
      await timeout(500);
      await getPreviousPosts();
      reset();
    } catch (error) {
      loading = false;
      console.error("Something went wrong.", error);
    }
    loading = false;
  }

  async function getPreviousPosts() {
    let pub = await window.nostr.getPublicKey();
    let rel = await getSupportedRelays();
    await findPreviousPosts(rel, pub, (event) => {
      handlePrevious(event);
    });
  }
  onMount(async () => {
    await timeout(500);
    hasNIP07 = Boolean(window.nostr);
    if (!hasNIP07) return;
    await getPreviousPosts();
  });
</script>

<section>
  <div class="header">
    <hgroup>
      <h1>Send blog post to Nostr</h1>
      <h3>
        Send blog post like notes, using Mardown, to Nostr relays supporting <a
          href="https://github.com/nostr-protocol/nips/blob/master/33.md#nip-33"
          target="_blank"
          rel="noopener noreferrer">NIP33</a
        >. Nostrium blog client coming soon...
      </h3>
    </hgroup>
    <small
      >You need to have a signing browser extension (<a
        href="https://github.com/nostr-protocol/nips/blob/master/07.md#nip-07"
        target="_blank"
        rel="noopener noreferrer">NIP07</a
      >) to use this tool</small
    >
  </div>
  <div>
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
          <label for="title">Post Title</label>
          <input
            type="text"
            bind:value={title}
          />
          <small>Slug: {title ? slugify(title.toLowerCase()) : ""}</small>
        </fieldset>
        <div class="markdown-editor">
          <div class="left-panel">
            <label for="post">Write post</label>
            <textarea
              bind:value={source}
              class="source"
            />
            <br />
            <label for="excerpt">Excerpt</label>
            <textarea
              placeholder="Summary"
              bind:value={excerpt}
            />
            <small>A small intro text (Optional)</small>
          </div>
        </div>
        <label for="image">Post hero image</label>
        <input
          placeholder="https://images.unsplash.com/photo....."
          type="url"
          bind:value={hero}
        />
        <small>Add an URL for the image (Optional)</small>
        <fieldset>
          <label for="switch">
            <input
              type="checkbox"
              id="draft"
              name="draft"
              role="switch"
              bind:checked={draft}
              aria-busy={loading}
            />
            {draft ? "Draft" : "Final"}
          </label>
        </fieldset>
        <a
          on:click={handlePost}
          href="javascript:;"
          role="button">{draft ? "Publish Draft" : "Publish"}</a
        >
      </div>
      {#if showPreview}
        <div class="preview">
          <hgroup>
            <h3>Preview</h3>
          </hgroup>
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
      Check code on <a
        href="https://github.com/talvasconcelos/postr"
        target="_blank"
        rel="noopener noreferrer">Github</a
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
  }
</style>
