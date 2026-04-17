"use client";

import { useEffect, useId, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { CommandPalette } from "@/components/directory/command-palette";
import { ParticleField } from "@/components/directory/particle-field";
import { SketchEmblem } from "@/components/directory/sketch-emblem";
import { WebsiteIcon } from "@/components/directory/website-icon";
import { ArrowUpRightIcon, CommandIcon, MoonIcon, SearchIcon, ShieldIcon, SiteIcon, SunIcon } from "@/components/icons";
import { resolveBuiltinIcon, resolveCategoryIcon } from "@/lib/category-icons";
import type {
  CategoryWithLinks,
  CommandItemRecord,
  LensShortcut,
  PublicDirectoryLink,
  SearchDirectoryParams,
  SearchFacetCounts,
  SiteSettingsRecord
} from "@/lib/types";

type DirectoryPageKind = "home" | "category" | "tag" | "collection" | "view" | "search";

type DirectoryPageData = {
  kind: DirectoryPageKind;
  eyebrow: string;
  title: string;
  subtitle: string;
  stats: string[];
  searchPlaceholder: string;
  searchParams?: Partial<SearchDirectoryParams>;
  links: PublicDirectoryLink[];
  lensSectionQuote?: string;
  lensSectionAttribution?: string;
  sectionKicker: string;
  sectionTitle: string;
  sectionNote?: string;
  emptyMessage: string;
  backHref?: string;
  backLabel?: string;
  facets?: SearchFacetCounts;
  gridVariant?: "featured" | "dense";
};

type DirectoryShellProps = {
  categories: CategoryWithLinks[];
  settings: SiteSettingsRecord;
  commandItems: CommandItemRecord[];
  lensShortcuts: {
    tags: LensShortcut[];
    collections: LensShortcut[];
    views: LensShortcut[];
  };
  page: DirectoryPageData;
  activeCategorySlug?: string;
};

const DESCRIPTION_TOOLTIP_DELAY_MS = 900;
const DESCRIPTION_TOOLTIP_WIDE_LINE_THRESHOLD = 4;

function toSearchHref(params: Partial<SearchDirectoryParams>) {
  const search = new URLSearchParams();

  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.category?.trim()) search.set("category", params.category.trim());
  if (params.tag?.trim()) search.set("tag", params.tag.trim());
  if (params.collection?.trim()) search.set("collection", params.collection.trim());
  if (params.featured && params.featured !== "all") search.set("featured", params.featured);
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.sort && params.sort !== "relevance") search.set("sort", params.sort);

  const query = search.toString();
  return query ? `/search?${query}` : "/search";
}

function buildListingMeta(link: PublicDirectoryLink, page: DirectoryPageData) {
  const customMeta = [link.displayChipPrimary, link.displayChipSecondary]
    .filter((item): item is string => Boolean(item?.trim()))
    .map((item) => item.trim());

  if (customMeta.length) {
    return [...new Set(customMeta)].slice(0, 2);
  }

  const meta: string[] = [];

  if (page.kind === "home" || page.kind === "search") {
    meta.push(link.categoryName);
  }

  if (page.searchParams?.tag !== link.tags[0]?.slug && link.tags[0]) {
    meta.push(link.tags[0].name);
  }

  if (page.searchParams?.collection !== link.collections[0]?.slug && link.collections[0]) {
    meta.push(link.collections[0].name);
  }

  if (link.featured) {
    meta.unshift("\u63a8\u8350");
  }

  return [...new Set(meta)].slice(0, 2);
}

function isFeaturedMetaLabel(label: string) {
  const normalized = label.trim().toLowerCase();
  return label.trim() === "推荐" || normalized === "featured";
}

function renderFacetGroup(
  label: string,
  items: Array<{ value: string; label: string; count: number }>,
  currentParams: Partial<SearchDirectoryParams>,
  key: "category" | "tag" | "collection" | "status"
) {
  if (!items.length) {
    return null;
  }

  const currentValue = currentParams[key] ?? "";

  return (
    <div className="facet-group">
      <p className="facet-label">{label}</p>
      <div className="facet-chip-row">
        {items.map((item) => {
          const isActive = currentValue === item.value;
          const href = toSearchHref({
            ...currentParams,
            [key]: isActive ? "" : item.value
          });

          return (
            <Link key={`${key}-${item.value}`} href={href} className={`facet-chip ${isActive ? "is-active" : ""}`}>
              <span>{item.label}</span>
              <small>{item.count}</small>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ListingDescription({ text }: { text: string }) {
  const tooltipId = useId();
  const descriptionRef = useRef<HTMLParagraphElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const tooltipMeasureRef = useRef<HTMLSpanElement | null>(null);
  const cardRef = useRef<HTMLAnchorElement | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const lastPointerTypeRef = useRef<string | null>(null);
  const touchPreviewPendingRef = useRef(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [useWideTooltip, setUseWideTooltip] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const textNode = textRef.current;
    const tooltipMeasureNode = tooltipMeasureRef.current;

    if (!textNode || !tooltipMeasureNode) {
      return;
    }

    let frameId = 0;
    let resizeObserver: ResizeObserver | null = null;

    const measure = () => {
      const nextIsTruncated =
        textNode.scrollHeight > textNode.clientHeight + 1 || textNode.scrollWidth > textNode.clientWidth + 1;
      setIsTruncated(nextIsTruncated);

      if (!nextIsTruncated) {
        setShowTooltip(false);
        setUseWideTooltip(false);
        return;
      }

      const computedStyle = window.getComputedStyle(tooltipMeasureNode);
      const lineHeight = Number.parseFloat(computedStyle.lineHeight);
      const paddingTop = Number.parseFloat(computedStyle.paddingTop);
      const paddingBottom = Number.parseFloat(computedStyle.paddingBottom);
      const verticalPadding = (Number.isFinite(paddingTop) ? paddingTop : 0) + (Number.isFinite(paddingBottom) ? paddingBottom : 0);
      const contentHeight = tooltipMeasureNode.scrollHeight - verticalPadding;

      const nextUseWideTooltip = Number.isFinite(lineHeight)
        ? contentHeight > lineHeight * DESCRIPTION_TOOLTIP_WIDE_LINE_THRESHOLD + 1
        : tooltipMeasureNode.scrollHeight > 132;

      setUseWideTooltip(nextUseWideTooltip);
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(scheduleMeasure);
      resizeObserver.observe(textNode);
      resizeObserver.observe(tooltipMeasureNode);
      if (textNode.parentElement) {
        resizeObserver.observe(textNode.parentElement);
      }
    } else {
      window.addEventListener("resize", scheduleMeasure);
    }

    if ("fonts" in document) {
      void (document as Document & { fonts: FontFaceSet }).fonts.ready.then(scheduleMeasure);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [text]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  const clearHoverTimer = () => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const isTouchLikePointer = (pointerType: string | null) =>
    pointerType === "touch" || pointerType === "pen" || window.matchMedia("(hover: none), (pointer: coarse)").matches;

  const hideTooltip = () => {
    clearHoverTimer();
    touchPreviewPendingRef.current = false;
    setShowTooltip(false);
  };

  useEffect(() => {
    const cardNode = descriptionRef.current?.closest("a");
    if (!(cardNode instanceof HTMLAnchorElement)) {
      cardRef.current = null;
      return;
    }

    cardRef.current = cardNode;

    const handleFocus = () => {
      if (!isTruncated || touchPreviewPendingRef.current) {
        return;
      }

      clearHoverTimer();
      setShowTooltip(true);
    };

    const handleBlur = () => {
      hideTooltip();
    };

    cardNode.addEventListener("focus", handleFocus);
    cardNode.addEventListener("blur", handleBlur);

    return () => {
      cardNode.removeEventListener("focus", handleFocus);
      cardNode.removeEventListener("blur", handleBlur);
    };
  }, [isTruncated]);

  useEffect(() => {
    if (!showTooltip) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && descriptionRef.current?.contains(target)) {
        return;
      }

      hideTooltip();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      hideTooltip();
      cardRef.current?.blur();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showTooltip]);

  useEffect(() => {
    const cardNode = cardRef.current;
    if (!cardNode) {
      return;
    }

    if (showTooltip && isTruncated) {
      cardNode.classList.add("has-active-description-tooltip");
      cardNode.setAttribute("aria-describedby", tooltipId);
      return () => {
        cardNode.classList.remove("has-active-description-tooltip");
        cardNode.removeAttribute("aria-describedby");
      };
    }

    cardNode.classList.remove("has-active-description-tooltip");
    cardNode.removeAttribute("aria-describedby");
  }, [isTruncated, showTooltip, tooltipId]);

  const handlePointerEnter = (event: ReactPointerEvent<HTMLParagraphElement>) => {
    if (!isTruncated) {
      return;
    }

    if (event.pointerType === "touch") {
      return;
    }

    clearHoverTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      setShowTooltip(true);
      hoverTimerRef.current = null;
    }, DESCRIPTION_TOOLTIP_DELAY_MS);
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLParagraphElement>) => {
    if (event.pointerType === "touch") {
      return;
    }

    hideTooltip();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLParagraphElement>) => {
    const pointerType = event.pointerType || null;
    lastPointerTypeRef.current = pointerType;
    touchPreviewPendingRef.current = isTruncated && !showTooltip && isTouchLikePointer(pointerType);
  };

  const handleClick = (event: ReactMouseEvent<HTMLParagraphElement>) => {
    if (!isTruncated) {
      return;
    }

    const shouldOpenTouchPreview = touchPreviewPendingRef.current;
    const isTouchInteraction = shouldOpenTouchPreview || isTouchLikePointer(lastPointerTypeRef.current);

    if (!isTouchInteraction || showTooltip) {
      return;
    }

    if (shouldOpenTouchPreview) {
      event.preventDefault();
      event.stopPropagation();
      clearHoverTimer();
      touchPreviewPendingRef.current = false;
      setShowTooltip(true);
    }
  };

  return (
    <p
      ref={descriptionRef}
      className={`listing-description ${isTruncated ? "has-delayed-tooltip" : ""} ${showTooltip ? "is-tooltip-visible" : ""}`}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <span ref={textRef} className="listing-description-text">
        {text}
      </span>
      <span ref={tooltipMeasureRef} className="listing-description-tooltip listing-description-tooltip--measure" aria-hidden="true">
        {text}
      </span>
      {isTruncated ? (
        <span
          id={tooltipId}
          className={`listing-description-tooltip ${useWideTooltip ? "is-wide" : ""}`}
          role="tooltip"
          aria-hidden={!showTooltip}
        >
          {text}
        </span>
      ) : null}
    </p>
  );
}

export function DirectoryShell({ categories, settings, commandItems, lensShortcuts, page, activeCategorySlug }: DirectoryShellProps) {
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(settings.defaultTheme);
  const [navExpanded, setNavExpanded] = useState(false);
  const homeRailLabel = settings.homeRailLabel.trim() || "首页";

  const showLensStrip = page.kind === "home";
  const showFacetPanel = Boolean(page.facets) && page.kind === "search";
  const searchContext = page.searchParams ?? {};

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("nav-theme");
    const nextTheme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : settings.defaultTheme;
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }, [settings.defaultTheme]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isTypingTarget =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }

      if (event.key === "/" && !paletteOpen && activeElement !== searchRef.current && !isTypingTarget) {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paletteOpen]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("nav-theme", nextTheme);
  };

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <ParticleField />
      <div className="site-shell">
        <div className={`directory-layout ${navExpanded ? "nav-expanded" : ""}`}>
          <aside className={`side-rail ${navExpanded ? "is-open" : ""}`}>
            <div className="side-rail-inner">
              <button
                type="button"
                className="rail-toggle"
                onClick={() => setNavExpanded((current) => !current)}
                aria-label={navExpanded ? "Collapse categories" : "Expand categories"}
              >
                <span className="rail-toggle-text">{navExpanded ? "CLOSE" : "NAV"}</span>
              </button>

              <nav className="side-nav" aria-label="Categories">
                <Link href="/" className={`side-nav-item ${pathname === "/" ? "is-active" : ""}`} title={homeRailLabel}>
                  <SiteIcon name={resolveBuiltinIcon(settings.homeRailIcon, "compass")} className="side-nav-icon" />
                  <span className="side-nav-label">{homeRailLabel}</span>
                </Link>
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/category/${category.slug}`}
                    className={`side-nav-item ${activeCategorySlug === category.slug ? "is-active" : ""}`}
                    title={category.name}
                  >
                    <SiteIcon name={resolveCategoryIcon(category.icon, category.slug)} className="side-nav-icon" />
                    <span className="side-nav-label">{category.name}</span>
                    <small className="side-nav-count">{category.links.length}</small>
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          <div className="content-area">
            <header className="site-header">
              <Link href="/" className="brand-lockup">
                <span className="brand-mark">{settings.brandMark}</span>
                <span className="brand-sub">{settings.brandSub}</span>
              </Link>
              <div className="header-actions">
                <button type="button" className="icon-button" onClick={() => setPaletteOpen(true)} aria-label="打开命令面板">
                  <CommandIcon className="button-icon" />
                </button>
                <button type="button" className="icon-button" onClick={toggleTheme} aria-label="切换主题" aria-pressed={theme === "dark"}>
                  {theme === "light" ? <MoonIcon className="button-icon" /> : <SunIcon className="button-icon" />}
                </button>
                <Link href="/admin" className="icon-button" aria-label="打开后台">
                  <ShieldIcon className="button-icon" />
                </Link>
              </div>
            </header>

            <main id="main-content" className="page-main">
              <section className={`hero-panel ${page.kind !== "home" ? "is-compact" : ""}`}>
                <div className="hero-copy">
                  <p className="eyebrow">{page.eyebrow}</p>
                  <h1 className="hero-title" data-text={page.title}>
                    {page.title}
                  </h1>
                  <p className="hero-subtitle">{page.subtitle}</p>
                  <form action="/search" className="hero-search">
                    {searchContext.category ? <input type="hidden" name="category" value={searchContext.category} /> : null}
                    {searchContext.tag ? <input type="hidden" name="tag" value={searchContext.tag} /> : null}
                    {searchContext.collection ? <input type="hidden" name="collection" value={searchContext.collection} /> : null}
                    {searchContext.featured && searchContext.featured !== "all" ? (
                      <input type="hidden" name="featured" value={searchContext.featured} />
                    ) : null}
                    {searchContext.status && searchContext.status !== "all" ? <input type="hidden" name="status" value={searchContext.status} /> : null}
                    {searchContext.sort && searchContext.sort !== "relevance" ? <input type="hidden" name="sort" value={searchContext.sort} /> : null}
                    <SearchIcon className="header-search-icon" />
                    <input
                      ref={searchRef}
                      name="q"
                      className="header-search-input"
                      placeholder={page.searchPlaceholder}
                      defaultValue={searchContext.q ?? ""}
                    />
                    <kbd className="header-kbd">/</kbd>
                  </form>
                  <div className="hero-meta">
                    {page.stats.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
                <div className="hero-art">
                  <SketchEmblem />
                </div>
              </section>

              {showLensStrip ? (
                <section className="content-section">
                  <div className="quote-band">
                    {page.lensSectionQuote ? (
                      <blockquote className="quote-band-block" aria-label="精选引言">
                        <p className="quote-band-text">{page.lensSectionQuote}</p>
                        {page.lensSectionAttribution ? <footer className="quote-band-attribution">{"\u2014\u2014 "}{page.lensSectionAttribution}</footer> : null}
                      </blockquote>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section className="content-section">
                <div className="section-header">
                  <div className="section-stack">
                    <p className="section-kicker">{page.sectionKicker}</p>
                    <h2 className="section-title">{page.sectionTitle}</h2>
                  </div>
                  <div className="section-stack section-stack--end">
                    {page.sectionNote ? <p className="section-note">{page.sectionNote}</p> : null}
                    {page.backHref && page.backLabel ? (
                      <Link href={page.backHref} className="section-link">
                        {page.backLabel}
                      </Link>
                    ) : null}
                  </div>
                </div>

                {showFacetPanel && page.facets ? (
                  <div className="facet-panel">
                    <div className="facet-summary">
                      <p className="facet-summary-title">{"\u7ee7\u7eed\u6536\u7a84\u7ed3\u679c"}</p>
                      <p className="facet-summary-note">{"\u4e0b\u65b9\u6240\u6709\u7b5b\u9009\u90fd\u4f1a\u751f\u6210\u53ef\u5206\u4eab\u7684 `/search` \u94fe\u63a5\uff0c\u5f53\u524d\u7ed3\u679c\u5207\u7247\u53ef\u4ee5\u76f4\u63a5\u590d\u7528\u3002"}</p>
                    </div>
                    {renderFacetGroup("\u5206\u7c7b", page.facets.categories, searchContext, "category")}
                    {renderFacetGroup("\u6807\u7b7e", page.facets.tags, searchContext, "tag")}
                    {renderFacetGroup("\u96c6\u5408", page.facets.collections, searchContext, "collection")}
                    {renderFacetGroup("\u5065\u5eb7\u72b6\u6001", page.facets.statuses, searchContext, "status")}
                  </div>
                ) : null}

                {page.links.length === 0 ? (
                  <div className="empty-panel">
                    <SearchIcon className="empty-icon" />
                    <p>{page.emptyMessage}</p>
                  </div>
                ) : (
                  <div className={`listing-grid ${page.gridVariant === "dense" ? "listing-grid--dense" : "listing-grid--featured"}`}>
                    {page.links.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`listing-card ${link.featured ? "is-featured" : ""}`}
                      >
                        <div className="listing-icon">
                          <WebsiteIcon
                            linkId={link.id}
                            url={link.url}
                            icon={link.icon}
                            iconUrl={link.iconUrl}
                            faviconUrl={link.metadata?.faviconUrl ?? link.faviconUrl}
                            preferredSource={link.preferredFaviconSource}
                            title={link.displayTitle}
                          />
                        </div>
                        <div className="listing-body">
                          <div className="listing-topline">
                            <span className="listing-title" title={link.displayTitle}>
                              {link.displayTitle}
                            </span>
                            <ArrowUpRightIcon className="listing-arrow" />
                          </div>
                          <ListingDescription text={link.displayDescription} />
                          <div className="listing-meta">
                            {buildListingMeta(link, page).map((item) => (
                              <span key={`${link.id}-${item}`} className={isFeaturedMetaLabel(item) ? "is-featured-chip" : undefined}>
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            </main>
          </div>
        </div>
      </div>

      <CommandPalette open={paletteOpen} items={commandItems} theme={theme} onClose={() => setPaletteOpen(false)} onToggleTheme={toggleTheme} />
    </>
  );
}

