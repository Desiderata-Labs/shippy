import {
  OpenGraphImage,
  contentType,
  size,
} from '@/components/app/opengraph-image'

export const alt = 'Documentation - Shippy'
export { size, contentType }

export default async function Image() {
  return OpenGraphImage({
    title: 'Documentation',
    description: 'Guides and references for using Shippy.',
  })
}
