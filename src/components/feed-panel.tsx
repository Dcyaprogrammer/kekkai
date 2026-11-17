import { useEffect, useState } from 'react'
import { Button } from '@ui-sdk/react/button'
import { Github } from './github-icon'
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@ui-sdk/react/segmented-control'
import { Toggle } from '@ui-sdk/react/toggle'
import {
  ArrowDownToLine,
  ArrowUpRight,
  Bookmark,
  CircleAlert,
  GitFork,
  RefreshCw,
  Rss,
  Star,
  TrendingUp,
} from 'lucide-react'
import { feedSources, type FeedSource } from '../feeds'
import { parseFeed, type FeedEntry, type FeedResult } from '../workspace'

const number = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#a68a00',
  Python: '#3572a5',
  Rust: '#b45024',
  Go: '#007d9c',
  Java: '#b07219',
  'C++': '#b03886',
  HTML: '#d34b2c',
  Shell: '#648c20',
  Swift: '#e3623e',
}

function RepositoryCard({
  entry,
  saved,
  onSave,
}: {
  entry: FeedEntry
  saved: boolean
  onSave: (entry: FeedEntry) => void
}) {
  const [owner, ...repo] =
    entry.source === 'github-trending' ? entry.title.split('/') : [entry.title]
  return (
    <article className="repository-card">
      <div className="repo-top">
        <span className="repo-avatar">
          {entry.source === 'github-trending' ? (
            <GitFork size={19} strokeWidth={1.6} />
          ) : (
            <Rss size={19} strokeWidth={1.6} />
          )}
        </span>
        <Toggle
          className="icon-button save-button"
          pressed={saved}
          onPressedChange={() => onSave(entry)}
          aria-label={`Save ${entry.title}`}
        >
          <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />
        </Toggle>
      </div>
      <Button
        className="repo-link"
        render={
          <a href={entry.url} target="_blank" rel="noopener noreferrer" />
        }
      >
        <span>
          {repo.length ? `${owner} / ` : ''}
          <strong>{repo.length ? repo.join('/') : owner}</strong>
        </span>
        <ArrowUpRight size={15} />
      </Button>
      {entry.description && <p className="repo-description">{entry.description}</p>}
      <div className="repo-meta">
        {entry.language && (
          <span>
            <i
              className="language-dot"
              style={{
                backgroundColor: languageColors[entry.language] ?? '#71717a',
              }}
            />
            {entry.language}
          </span>
        )}
        {entry.stars !== undefined && (
          <span>
            <Star size={13} />
            {number.format(entry.stars)}
          </span>
        )}
        {entry.gained !== undefined && (
          <span className="repo-growth">
            <TrendingUp size={13} />
            {number.format(entry.gained)}
          </span>
        )}
      </div>
    </article>
  )
}

type Props = {
  saved: FeedEntry[]
  onSave: (entry: FeedEntry) => void
  savedOnly?: boolean
  source?: FeedSource
  limit?: number
  onSeeAll?: () => void
}

export function FeedPanel({
  saved,
  onSave,
  savedOnly = false,
  source = feedSources[0],
  limit,
  onSeeAll,
}: Props) {
  const [period, setPeriod] = useState<FeedResult['period']>('daily')
  const [responseState, setResponseState] = useState<{
    key: string
    result: FeedResult | null
    error: string
  } | null>(null)
  const [refresh, setRefresh] = useState(0)
  const requestKey = `${source.id}:${period}:${refresh}`
  const current = responseState?.key === requestKey ? responseState : null
  const result = current?.result ?? null
  const error = current?.error ?? ''
  const loading = !savedOnly && !current

  useEffect(() => {
    if (savedOnly) return
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(
          `/api/feeds/${source.id}?period=${period}`,
          {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(18000),
            ]),
          },
        )
        if (!response.ok)
          throw new Error(
            `${source.name} is unavailable. Retry or open the source.`,
          )
        const data = parseFeed(await response.json(), source.id, period)
        if (!controller.signal.aborted)
          setResponseState({ key: requestKey, result: data, error: '' })
      } catch (cause) {
        if (!controller.signal.aborted)
          setResponseState({
            key: requestKey,
            result: null,
            error:
              cause instanceof Error && cause.name !== 'TimeoutError'
                ? cause.message
                : 'The feed timed out. Try again.',
          })
      }
    }
    void load()
    return () => controller.abort()
  }, [period, requestKey, savedOnly, source.id, source.name])

  const entries = savedOnly ? saved : (result?.entries ?? [])
  return (
    <section className="feed-section" aria-labelledby="feeds-title">
      <div className="feed-container">
        <div className="feed-toolbar">
          <div className="feed-source">
            {savedOnly ? (
              <Bookmark size={19} />
            ) : source.id === 'github-trending' ? (
              <Github size={19} />
            ) : (
              <Rss size={19} />
            )}
            <h2 id="feeds-title">{savedOnly ? 'Saved' : source.name}</h2>
            {savedOnly && <span className="count-badge">{saved.length}</span>}
          </div>
          {!savedOnly && (
            <div className="feed-controls">
              {source.periods.length > 0 && (
                <SegmentedControl
                  aria-label="Trending period"
                  className="segments compact"
                  value={period}
                  onValueChange={(value) => {
                    if (value === 'daily' || value === 'weekly')
                      setPeriod(value)
                  }}
                >
                  {source.periods.map((option) => (
                    <SegmentedControlItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
              )}
              <Button
                className={`icon-button${loading ? ' spinning' : ''}`}
                aria-label={`Refresh ${source.name}`}
                disabled={loading}
                onClick={() => setRefresh((value) => value + 1)}
              >
                <RefreshCw size={15} />
              </Button>
              <Button
                className="icon-button"
                aria-label={source.linkLabel}
                title={source.linkLabel}
                render={
                  <a href={source.url} target="_blank" rel="noopener noreferrer" />
                }
              >
                <ArrowUpRight size={17} />
              </Button>
            </div>
          )}
        </div>
        {result?.stale && (
          <div className="feed-warning" role="status">
            <CircleAlert size={15} />
            {source.name} is unavailable. Showing the last successful update.
          </div>
        )}
        {loading ? (
          <div
            className="repository-grid"
            aria-label={`Loading ${source.name}`}
            aria-busy="true"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <div className="repository-card skeleton-card" key={index}>
                <span />
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : error && !savedOnly ? (
          <div className="feed-empty">
            <CircleAlert size={25} />
            <h3>Feed unavailable</h3>
            <p>{error}</p>
            <Button
              className="button secondary small"
              onClick={() => setRefresh((value) => value + 1)}
            >
              <RefreshCw size={14} />
              Try again
            </Button>
          </div>
        ) : entries.length ? (
          <div className="repository-grid">
            {entries.slice(0, limit).map((entry) => (
              <RepositoryCard
                key={entry.id}
                entry={entry}
                saved={saved.some((item) => item.id === entry.id)}
                onSave={onSave}
              />
            ))}
          </div>
        ) : (
          <div className="feed-empty">
            {savedOnly ? <Bookmark size={25} /> : <ArrowDownToLine size={25} />}
            <h3>{savedOnly ? 'No saved items' : 'No items'}</h3>
            <p>
              {savedOnly
                ? 'Use the bookmark on a repository to save it here.'
                : 'Refresh or open the source.'}
            </p>
          </div>
        )}
        <footer className="feed-footer">
          <span>
            <span className={`status-dot${error ? ' status-error' : ''}`} />
            {savedOnly
              ? `${saved.length} saved ${saved.length === 1 ? 'discovery' : 'discoveries'}`
              : result
                ? `${result.stale ? 'Last fetched' : 'Fetched'} ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(result.fetchedAt))}`
                : loading
                  ? 'Finding what’s trending…'
                  : 'Source temporarily unavailable'}
          </span>
          {limit && entries.length > limit && onSeeAll ? (
            <Button className="button ghost small" onClick={onSeeAll}>
              View all {entries.length}
              <ArrowUpRight size={12} />
            </Button>
          ) : (
            <span>
              {!savedOnly &&
                source.id === 'github-trending' &&
                `Stars gained ${period === 'daily' ? 'today' : 'this week'}`}
            </span>
          )}
        </footer>
      </div>
    </section>
  )
}
