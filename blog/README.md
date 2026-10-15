# Blog

Each post is one Markdown file in this folder. The file name is the address: `my-first-post.md` becomes `/blog/my-first-post`.

Start the file with this header, then write the post in Markdown:

```md
---
title: What I learned shipping Helio
date: 2026-10-20
summary: One plain sentence for the index and link previews.
cover: /blog/helio-lessons.jpg
tags: Product, AI
draft: false
---

The post starts here. **Bold**, *italic*, [links](https://example.com), lists, quotes, tables, code blocks, and images all work.

## A section

Sections made with `##` show up in the contents list beside long posts.
```

- **cover** (optional): put the image in `public/blog/` and give its path. Wide images (about 16:10) look best.
- **credit** (optional): `Photo: Name, License | https://link-to-source` for photos that need credit.
- **tags** (optional): comma separated. Tags become the filters on the blog page.
- **draft: true** keeps a post off the site.
- Images inside a post: put them in `public/blog/` too and use `![What it shows](/blog/picture.jpg)`.

Push to `main` and the site rebuilds with the post. The Ask assistant on the site learns new posts on the same build.
