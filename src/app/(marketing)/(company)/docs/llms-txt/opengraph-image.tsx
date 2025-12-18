import {
  OpenGraphImage,
  contentType,
  size,
} from '@/components/app/opengraph-image'

export const alt = 'llms.txt - Shippy'
export { size, contentType }

export default async function Image() {
  return OpenGraphImage({
    title: 'llms.txt',
    description:
      'LLM-friendly documentation endpoint following the llms.txt standard.',
  })
}
