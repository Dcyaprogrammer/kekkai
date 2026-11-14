export type FeedSource = {
  id: string
  name: string
  description: string
  url: string
  linkLabel: string
  periods: { value: 'daily' | 'weekly'; label: string }[]
}

export const feedSources: FeedSource[] = [
  {
    id: 'github-trending',
    name: 'GitHub Trending',
    description: 'What the developer community is discovering.',
    url: 'https://github.com/trending',
    linkLabel: 'Open GitHub',
    periods: [
      { value: 'daily', label: 'Today' },
      { value: 'weekly', label: 'This week' },
    ],
  },
]
