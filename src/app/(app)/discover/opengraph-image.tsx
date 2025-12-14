import {
  OpenGraphImage,
  contentType,
  size,
} from '@/components/app/opengraph-image'

export const alt = 'Discover Projects on Shippy'
export { size, contentType }

export default async function Image() {
  return OpenGraphImage({
    title: 'Discover Projects',
    description:
      'Find startups looking for contributors. Earn points and recurring payouts for your work.',
  })
}
