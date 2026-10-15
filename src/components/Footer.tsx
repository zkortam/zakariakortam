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
          <div className="grid-main items-baseline">
            <p className="c1 oc col-span-4 text-statement md:col-span-6" data-rise="">
              {COPY.footerHead}
            </p>
            <p className="c1 col-span-4 mt-[24px] text-read md:col-span-6 md:col-start-7 md:mt-0" data-reveal="">
              <ULink href={`mailto:${EMAIL}`}>{EMAIL}</ULink>
            </p>
          </div>
          <div className="grid-main footer-row2 text-body">
            <ul className="col-span-2 flex flex-col gap-[4px] md:col-start-7" data-reveal="">
              {NAV.map((l) => (
                <li key={l.href}>
                  <TLink href={l.href} className="flink">
                    {l.label}
                  </TLink>
                </li>
              ))}
            </ul>
            <ul className="socials col-span-4 mt-[20px] self-start md:col-span-2 md:col-start-9 md:-mt-[11px]" data-reveal="">
              {SOCIALS.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`${s.label}, opens in a new tab`} title={s.label} className="flink">
                    <Icon name={s.icon} size={22} />
                  </a>
                </li>
              ))}
            </ul>
            <div className="c3 col-span-4 mt-[32px] flex flex-col gap-[4px] md:col-span-2 md:col-start-11 md:mt-0 md:text-right md:whitespace-nowrap" data-reveal="" data-align="end">
              <span>{LOCATION}</span>
              <span className="tnum">©{'\u00a0'}{YEAR}</span>
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
