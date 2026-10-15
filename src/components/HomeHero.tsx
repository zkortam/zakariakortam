import Image from 'next/image'
import { HeroDepth, HeroLayer } from './HeroDepth'
import { Wordmark } from './Wordmark'
import { PortraitLight } from './PortraitLight'
import { TLink } from './TLink'
import { HeroField } from './HeroField'
import { COPY } from '@/lib/site'

const NAMED: Record<string, string> = { Helio: 'helio', Surf: 'surf', 'SPICE++': 'spice-plus-plus', AiroFind: 'airofind' }

/** A product named in the opening line: its picture, then its name, linking to its page. */
function Named({ name }: { name: string }) {
  const id = NAMED[name]
  return (
    <TLink href={`/portfolio/${id}`} className="hs-name u-group">
      <span className="hs-thumb" aria-hidden="true">
        <Image src={`/work/thumb/${id}.webp`} alt="" width={96} height={96} sizes="48px" quality={82} priority />
      </span>
      <span className="u-box">
        {name}
        <span aria-hidden="true" className="u-line" />
      </span>
    </TLink>
  )
}

function withNames(line: string) {
  return line.split(/(Helio|Surf|SPICE\+\+|AiroFind)/).map((part, i) => (NAMED[part] ? <Named key={i} name={part} /> : part))
}

/** The opening plate: letterbox gate, light gathering behind the portrait, the name rising and parting. */
export function HomeHero() {
  return (
    <HeroDepth>
      <div className="hero-layer" aria-hidden="true">
        <HeroLayer kind="bloom" className="hero-bloom">
          <div className="fill bloom-in" />
        </HeroLayer>
        <HeroField />
      </div>

      <div className="hero-portrait">
        <HeroLayer kind="portrait" className="fillw">
          <div className="fillw portrait-in">
            <div className="mask">
              <Image
                src="/portrait/zakaria-plate.webp"
                width={1485}
                height={1485}
                priority
                fetchPriority="high"
                quality={90}
                sizes="(min-width:2400px) and (min-height:1300px) 1200px, (min-width:1680px) 960px, (min-width:768px) 640px, 560px"
                alt="Zakaria Kortam"
              />
              <PortraitLight />
            </div>
          </div>
        </HeroLayer>
      </div>

      <div className="hero-vignette" aria-hidden="true" />

      <div className="hero-statement">
        <HeroLayer kind="statement">
          <div className="grid-main">
            <p className="hs-p text-read col-span-4 md:col-span-6 md:col-start-7" style={{ color: 'var(--bone-92)' }}>
              {COPY.heroLines.map((l, i) => (
                <span key={i} className="hs-l" style={{ ['--i' as string]: i }}>
                  {withNames(l)}
                  {i < COPY.heroLines.length - 1 ? ' ' : ''}
                </span>
              ))}
            </p>
          </div>
        </HeroLayer>
      </div>

      <div className="hero-wm">
        <HeroLayer kind="wordmark">
          <div className="grid-main">
            <Wordmark as="h1" className="col-span-4 md:col-span-12" />
          </div>
        </HeroLayer>
      </div>
    </HeroDepth>
  )
}
