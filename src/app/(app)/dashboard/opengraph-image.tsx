import {
  OpenGraphImage,
  contentType,
  size,
} from '@/components/app/opengraph-image'

export const alt = 'Dashboard - Shippy'
export { size, contentType }

export default async function Image() {
  return OpenGraphImage({
    title: 'Dashboard',
    description:
      'Track your contributions, points, and earnings across projects.',
  })
}
