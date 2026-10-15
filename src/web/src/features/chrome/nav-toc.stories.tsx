import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { NavToc } from "./nav-toc";

/**
 * NavToc reads headings from the rendered article DOM, so the story mounts
 * the same `ref` pattern `MarkdownPage` uses. The rail shows only inside a
 * size container at least 59rem wide — narrower, the iframe shows nothing,
 * which is the real behavior.
 */
function ArticleWithToc() {
  const [article, setArticle] = useState<HTMLElement | null>(null);
  return (
    <div className="@container flex gap-8">
      <main ref={setArticle} className="w-full max-w-2xl">
        <h1>Quarterly report</h1>
        <h2 id="orders">Orders</h2>
        <p>Order volume by week and region.</p>
        <h2 id="revenue">Revenue</h2>
        <p>Revenue by week and region.</p>
        <h3 id="refunds">Refunds</h3>
        <p>Refunds subtracted from revenue.</p>
      </main>
      {article && <NavToc article={article} />}
    </div>
  );
}

const meta: Meta<typeof NavToc> = {
  title: "Chrome/NavToc",
  component: NavToc,
};

export default meta;

type Story = StoryObj<typeof NavToc>;

/** Headings become rail links; h3s indent one level under their h2. */
export const WithHeadings: Story = {
  render: () => <ArticleWithToc />,
  play: async ({ canvasElement }) => {
    const nav = canvasElement.querySelector('nav[aria-label="On this page"]');
    await expect(nav).not.toBeNull();
    const links = nav!.querySelectorAll("a");
    await expect([...links].map((a) => a.textContent)).toEqual([
      "Orders",
      "Revenue",
      "Refunds",
    ]);
    await expect(links[0]).toHaveAttribute("href", "#orders");
  },
};

/**
 * A page whose headings land 136px down — the offset `MarkdownPage` gives
 * them under a docked filter bar — with a short section right after the
 * jump target, so its successor also sits above mid-viewport.
 */
function ArticleWithDockedOffset() {
  const [article, setArticle] = useState<HTMLElement | null>(null);
  return (
    <div className="@container flex gap-8">
      <main
        ref={setArticle}
        className="w-full max-w-2xl [&_h2]:scroll-mt-[136px]"
      >
        <h1>Quarterly report</h1>
        <h2 id="orders">Orders</h2>
        <p className="h-[150vh]">Order volume by week and region.</p>
        <h2 id="mix">Order mix</h2>
        <p>One line of mix.</p>
        <h2 id="size">Order size</h2>
        <p className="h-[150vh]">Order size by week and region.</p>
      </main>
      {article && <NavToc article={article} />}
    </div>
  );
}

/** A jump lights the heading it landed on, not the short section after it. */
export const JumpedBelowDockedBar: Story = {
  render: () => <ArticleWithDockedOffset />,
  play: async ({ canvasElement }) => {
    const nav = canvasElement.querySelector('nav[aria-label="On this page"]');
    await expect(nav).not.toBeNull();
    window.location.hash = "mix";
    await waitFor(() =>
      expect(nav!.querySelector('[aria-current="location"]')).toHaveTextContent(
        "Order mix",
      ),
    );
  },
};

function ShortArticleWithToc() {
  const [article, setArticle] = useState<HTMLElement | null>(null);
  return (
    <div>
      <main ref={setArticle}>
        <h1>Lonely</h1>
        <h2 id="only">Only section</h2>
      </main>
      {article && <NavToc article={article} />}
    </div>
  );
}

/** Fewer than two headings → the rail renders nothing. */
export const TooFewHeadings: Story = {
  render: () => <ShortArticleWithToc />,
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector('nav[aria-label="On this page"]'),
    ).toBeNull();
  },
};
