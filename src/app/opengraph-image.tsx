import {
  OpenGraphImage,
  contentType,
  size,
} from '@/components/app/opengraph-image'

export const alt = 'Shippy - Ship work. Earn royalties.'
export { size, contentType }

export default function Image() {
  return OpenGraphImage({
    title: 'Ship work. Earn royalties.',
    description:
      'The platform where contributors earn recurring royalties for helping startups grow.',
  })
}
