# Sharing image and favicon

The portfolio uses the owner's approved cyan/violet glass FP image, unchanged,
at `/assets/social/portfolio-fp.png` (1731 x 909 PNG). The original background,
composition and pixels are preserved.

`src/components/SocialMeta.astro` provides Open Graph and large-image card
metadata for the homepage and shared page layout. Image and page URLs are
absolute and use the canonical site origin configured in `astro.config.mjs`.

The browser tab uses `/brand/fp-mark.svg`, a transparent vector drawing of the
same FP arrangement, with simplified glass facets and cyan/violet gradients
for readability at small sizes. It does not embed the PNG or draw a background.
The existing in-page header artwork remains independently configured.

Build and run the repository checks before publishing through the existing
GitHub Pages workflow. After publication, inspect `https://petrozzi.dev` in
LinkedIn Post Inspector to request a new link preview. Other sharing apps
may retain their own cached previews.
