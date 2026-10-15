import { FooterLight } from './FooterLight'
import { Wordmark } from './Wordmark'
import { ULink } from './ULink'
import { TLink } from './TLink'
import { Icon } from './Icon'
import { COPY, EMAIL, LOCATION, NAV, SOCIALS, YEAR } from '@/lib/site'

/** End credits. */
export function Footer() {
  return (
    <footer className="footer relative overflow-hidden" data-tone="dark">
      <FooterLight />
      <div className="footer-inner relative">
        <div>
          <div className="grid-main footer-top">
            <div className="col-span-4 md:col-span-6">
              <p className="c1 oc text-statement" data-rise="">
                {COPY.footerHead}
              </p>
              <p className="c1 mt-[16px] text-read" data-reveal="">
                <ULink href={`mailto:${EMAIL}`}>{EMAIL}</ULink>
              </p>
            </div>
            <ul className="col-span-2 mt-[48px] flex flex-col gap-[4px] text-body md:col-start-7 md:mt-0" data-reveal="">
              {NAV.map((l) => (
                <li key={l.href}>
                  <TLink href={l.href} className="flink">
                    {l.label}
                  </TLink>
                </li>
              ))}
            </ul>
            <div className="col-span-4 mt-[32px] text-body md:col-span-4 md:col-start-9 md:mt-0" data-reveal="">
              <ul className="socials">
                {SOCIALS.map((s) => (
                  <li key={s.label}>
                    <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`${s.label}, opens in a new tab`} title={s.label} className="flink">
                      <Icon name={s.icon} size={22} />
                    </a>
                  </li>
                ))}
              </ul>
              <p className="c3 mt-[12px] whitespace-nowrap">
                {LOCATION} · <span className="tnum">©{'\u00a0'}{YEAR}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="grid-main footer-wm">
          <Wordmark as="p" className="wm-foot col-span-4 md:col-span-12" />
        </div>
      </div>
    </footer>
  )
}
