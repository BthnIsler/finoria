import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query) {
        return NextResponse.json({ articles: [] });
    }

    try {
        // Use Google News RSS feed as a free news source
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=tr&gl=TR&ceid=TR:tr`;
        const res = await fetch(rssUrl, {
            next: { revalidate: 300 }, // Cache for 5 minutes
        });

        if (!res.ok) {
            throw new Error(`RSS fetch failed: ${res.status}`);
        }

        const xml = await res.text();

        // Parse RSS XML manually (lightweight, no dependency needed)
        const articles = parseRSSItems(xml).slice(0, 8);

        return NextResponse.json({ articles });
    } catch (error) {
        console.error('News fetch error:', error);
        return NextResponse.json({ articles: [], error: 'Failed to fetch news' });
    }
}

interface NewsArticle {
    title: string;
    link: string;
    pubDate: string;
    source: string;
}

function parseRSSItems(xml: string): NewsArticle[] {
    const items: NewsArticle[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1];
        const title = extractTag(itemXml, 'title');
        const link = extractTag(itemXml, 'link');
        const pubDate = extractTag(itemXml, 'pubDate');
        const source = extractTag(itemXml, 'source');

        if (title && link) {
            items.push({
                title: decodeHTMLEntities(title),
                link,
                pubDate: pubDate || '',
                source: source ? decodeHTMLEntities(source) : '',
            });
        }
    }

    return items;
}

function extractTag(xml: string, tag: string): string | null {
    // Handle CDATA
    const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
    const cdataMatch = cdataRegex.exec(xml);
    if (cdataMatch) return cdataMatch[1].trim();

    // Normal tag
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
    const normalMatch = regex.exec(xml);
    if (normalMatch) return normalMatch[1].trim();

    return null;
}

function decodeHTMLEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");
}
