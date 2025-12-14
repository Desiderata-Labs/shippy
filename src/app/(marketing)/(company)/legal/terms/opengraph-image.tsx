import {
  OpenGraphImage,
  contentType,
  size,
} from '@/components/app/opengraph-image'

export const alt = 'Terms of Service - Shippy'
export { size, contentType }

export default async function Image() {
  return OpenGraphImage({
    title: 'Terms of Service',
    description: 'The terms and conditions for using Shippy.',
  })
}
