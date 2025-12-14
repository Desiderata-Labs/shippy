import {
  OpenGraphImage,
  contentType,
  size,
} from '@/components/app/opengraph-image'

export const alt = 'Privacy Policy - Shippy'
export { size, contentType }

export default async function Image() {
  return OpenGraphImage({
    title: 'Privacy Policy',
    description: 'How Shippy collects, uses, and protects your data.',
  })
}
