import { useState } from 'react';
import { useGame } from '../../store';
import type { Property } from '../../engine/types';
import { DEVELOPMENT_OPTIONS } from '../../engine/content/realestate';
import { TUNING } from '../../engine/content/tuning';
import {
  isPropertyOccupied,
  netWorth,
  occupyingBusiness,
  propertyRentPerSecond,
  propertyValue,
  propertyYield,
  realEstateValue,
} from '../../engine/selectors';
import { clock, money, pct, rate, signedPct } from '../../engine/format';
import { Card, Chip, Empty, Meter, Modal, SectionLabel, Sparkline, Tile } from '../components/common';

const KIND_META = {
  residential: { icon: '🏠', label: 'Residential' },
  commercial: { icon: '🏢', label: 'Commercial' },
  land: { icon: '🏞️', label: 'Land' },
} as const;

export function EstateScreen() {
  const { state, dispatch } = useGame();
  const [cityId, setCityId] = useState<string>('portfolio');
  const [openId, setOpenId] = useState<string | null>(null);

  const nw = netWorth(state);
  const ownedProps = state.properties.filter((p) => p.owned);
  const totalValue = realEstateValue(state);
  const totalRent = ownedProps.reduce((sum, p) => sum + propertyRentPerSecond(state, p), 0);

  const cities = state.cities.filter((c) => nw >= c.unlockAt || ownedProps.some((p) => p.cityId === c.id));
  const lockedCity = state.cities.find((c) => !cities.includes(c));

  const open = state.properties.find((p) => p.id === openId) ?? null;

  return (
    <div className="screen">
      <div className="tiles" style={{ marginBottom: 12 }}>
        <Tile label="Holdings" value={money(totalValue)} sub={`${ownedProps.length} properties`} />
        <Tile label="Rent" value={`${money(totalRent)}/s`} tone="pos" />
        <Tile label="Cash" value={money(state.cash)} />
      </div>

      <div className="segmented">
        <button
          className={`segment ${cityId === 'portfolio' ? 'active' : ''}`}
          onClick={() => setCityId('portfolio')}
        >
          Mine ({ownedProps.length})
        </button>
        {cities.map((c) => (
          <button
            key={c.id}
            className={`segment ${cityId === c.id ? 'active' : ''}`}
            onClick={() => setCityId(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {cityId === 'portfolio' ? (
        ownedProps.length === 0 ? (
          <Empty>
            You own no property. Pick a city above — commercial units can also house your businesses,
            killing their rent and widening their margin.
          </Empty>
        ) : (
          <Card flush>
            {ownedProps.map((p) => (
              <PropertyRow key={p.id} property={p} onOpen={() => setOpenId(p.id)} />
            ))}
          </Card>
        )
      ) : (
        <CityMarket cityId={cityId} onOpen={setOpenId} />
      )}

      {cityId === 'portfolio' && lockedCity && (
        <Card className="locked" style={{ marginTop: 10 }}>
          <div className="row">
            <div>
              <div style={{ fontWeight: 600 }}>{lockedCity.name}</div>
              <div className="hint">Unlocks at {money(lockedCity.unlockAt)} net worth</div>
            </div>
            <span style={{ fontSize: 20 }}>🔒</span>
          </div>
        </Card>
      )}

      {open && <PropertyDetail property={open} onClose={() => setOpenId(null)} />}

      {cityId !== 'portfolio' && (
        <button
          className="btn btn-ghost btn-block"
          style={{ marginTop: 4 }}
          onClick={() => dispatch({ type: 'refreshListings', cityId })}
        >
          Refresh listings — {money(5_000 + Math.max(0, nw) * 0.0008)}
        </button>
      )}
    </div>
  );
}

function CityMarket({ cityId, onOpen }: { cityId: string; onOpen: (id: string) => void }) {
  const { state } = useGame();
  const city = state.cities.find((c) => c.id === cityId);
  const listings = state.properties.filter((p) => p.cityId === cityId && !p.owned);
  if (!city) return null;

  const indexChange = city.history.length > 1 ? (city.index - city.history[0]) / city.history[0] : 0;

  return (
    <>
      <Card>
        <div className="row">
          <div>
            <div className="tile-label">{city.name} market index</div>
            <div className="row row-tight" style={{ marginTop: 2 }}>
              <span className="num" style={{ fontSize: 19, fontWeight: 640 }}>{city.index.toFixed(3)}</span>
              <span className={`num ${indexChange >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 12.5 }}>
                {signedPct(indexChange)}
              </span>
            </div>
            <div className="faint" style={{ fontSize: 11.5 }}>
              Every value in {city.name} moves with this.
            </div>
          </div>
          <Sparkline data={city.history} width={92} height={34} />
        </div>
      </Card>

      <SectionLabel>On the market</SectionLabel>
      {listings.length === 0 ? (
        <Empty>Nothing listed right now. Refresh to pull new stock.</Empty>
      ) : (
        <Card flush>
          {listings.map((p) => (
            <PropertyRow key={p.id} property={p} onOpen={() => onOpen(p.id)} />
          ))}
        </Card>
      )}
    </>
  );
}

function PropertyRow({ property, onOpen }: { property: Property; onOpen: () => void }) {
  const { state } = useGame();
  const meta = KIND_META[property.kind];
  const value = propertyValue(state, property);
  const rentPerSec = propertyRentPerSecond(state, property);
  const occupied = isPropertyOccupied(state, property.id);
  const gain = property.owned ? value - property.purchasePrice : 0;

  return (
    <div className="listrow listrow-tap" onClick={onOpen}>
      <div className="avatar">{meta.icon}</div>
      <div className="grow">
        <div className="truncate" style={{ fontWeight: 570, fontSize: 13.5 }}>{property.name}</div>
        <div className="faint" style={{ fontSize: 11.5 }}>
          {property.development
            ? `Building ${property.development.label} · ${clock(property.development.remaining)} left`
            : property.developedType
              ? `Developed · ${pct(propertyYield(property), 1)} yield`
              : property.kind === 'land'
                ? 'Undeveloped land'
                : `${pct(propertyYield(property), 1)} yield`}
          {occupied && ' · houses a business'}
        </div>
        {property.development && (
          <div style={{ marginTop: 6 }}>
            <Meter
              value={1 - property.development.remaining / property.development.totalTime}
              color="var(--warn)"
            />
          </div>
        )}
      </div>
      <div className="col" style={{ alignItems: 'flex-end', flex: 'none' }}>
        <span className="num" style={{ fontSize: 13.5, fontWeight: 600 }}>{money(value)}</span>
        {property.owned ? (
          rentPerSec > 0 ? (
            <span className="num pos" style={{ fontSize: 11.5 }}>{rate(rentPerSec)}</span>
          ) : (
            <span className={`num ${gain >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 11.5 }}>
              {money(gain, { sign: true })}
            </span>
          )
        ) : (
          <span className="faint" style={{ fontSize: 11.5 }}>{KIND_META[property.kind].label}</span>
        )}
      </div>
    </div>
  );
}

function PropertyDetail({ property, onClose }: { property: Property; onClose: () => void }) {
  const { state, dispatch } = useGame();
  const value = propertyValue(state, property);
  const rentPerSec = propertyRentPerSecond(state, property);
  const occupant = occupyingBusiness(state, property.id);
  const city = state.cities.find((c) => c.id === property.cityId);

  // What this would pay if the player bought it — a listing showing "$0/s"
  // next to a healthy yield reads as broken rather than as "not yours yet".
  const projectedRent = (value * propertyYield(property)) / TUNING.secondsPerGameYear;

  const canDevelop = property.owned && property.kind === 'land' && !property.development && !property.developedType;

  return (
    <Modal open onClose={onClose}>
      <div className="modal-title">{property.name}</div>
      <div className="modal-body" style={{ marginBottom: 12 }}>
        {city?.name} · {KIND_META[property.kind].label}
      </div>

      <div className="tiles" style={{ marginBottom: 12 }}>
        <Tile label="Value" value={money(value)} />
        <Tile label="Yield" value={pct(propertyYield(property), 1)} />
        <Tile
          label={property.owned ? 'Rent' : 'Rent if bought'}
          value={`${money(property.owned ? rentPerSec : projectedRent)}/s`}
          tone={(property.owned ? rentPerSec : projectedRent) > 0 ? 'pos' : undefined}
        />
      </div>

      {occupant && (
        <div className="banner banner-brand">
          {occupant.name} operates out of this building — no rent collected here, but that business
          keeps a {pct(TUNING.ownedPropertyMarginBonus, 0)} wider margin.
        </div>
      )}

      {property.development && (
        <Card>
          <div className="card-head">
            <span className="card-title">{property.development.label}</span>
            <span className="num warn">{clock(property.development.remaining)}</span>
          </div>
          <Meter
            value={1 - property.development.remaining / property.development.totalTime}
            color="var(--warn)"
          />
          <div className="hint" style={{ marginTop: 8 }}>
            On completion this becomes worth ×{property.development.valueMultiplier} and starts
            yielding {pct(property.development.yieldBonus, 1)}.
          </div>
        </Card>
      )}

      {!property.owned && (
        <button
          className={`btn btn-block ${state.cash >= value ? 'btn-primary' : ''}`}
          disabled={state.cash < value}
          onClick={() => {
            dispatch({ type: 'buyProperty', propertyId: property.id });
            onClose();
          }}
        >
          Buy for {money(value)}
        </button>
      )}

      {canDevelop && (
        <>
          <SectionLabel>Develop this site</SectionLabel>
          <div className="hint" style={{ marginBottom: 10 }}>
            Building takes real time and a lot of capital, and it is by far the highest return in
            property. The site earns nothing while under construction.
          </div>
          {DEVELOPMENT_OPTIONS.map((d) => {
            const cost = value * d.costRatio;
            const affordable = state.cash >= cost;
            return (
              <Card key={d.type}>
                <div className="row">
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{d.label}</div>
                    <div className="hint" style={{ marginTop: 2 }}>{d.description}</div>
                    <div className="chiprow" style={{ marginTop: 7 }}>
                      <Chip tone="pos">×{d.valueMultiplier} value</Chip>
                      <Chip>{pct(d.yieldBonus, 1)} yield</Chip>
                      <Chip tone="warn">{clock(d.buildSeconds)} build</Chip>
                    </div>
                  </div>
                </div>
                <button
                  className={`btn btn-block btn-sm ${affordable ? 'btn-primary' : ''}`}
                  style={{ marginTop: 10 }}
                  disabled={!affordable}
                  onClick={() => {
                    dispatch({ type: 'developProperty', propertyId: property.id, devType: d.type });
                    onClose();
                  }}
                >
                  Build — {money(cost)}
                </button>
              </Card>
            );
          })}
        </>
      )}

      {property.owned && !property.development && (
        <>
          <div className="divider" />
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="dim" style={{ fontSize: 13 }}>Bought for</span>
            <span className="num">{money(property.purchasePrice)}</span>
          </div>
          <div className="row" style={{ marginBottom: 12 }}>
            <span className="dim" style={{ fontSize: 13 }}>Gain</span>
            <span className={`num ${value >= property.purchasePrice ? 'pos' : 'neg'}`}>
              {money(value - property.purchasePrice, { sign: true })}
            </span>
          </div>
          <button
            className="btn btn-neg btn-block btn-sm"
            onClick={() => {
              dispatch({ type: 'sellProperty', propertyId: property.id });
              onClose();
            }}
          >
            Sell for {money(value * (1 - TUNING.propertySaleFee))} ({pct(TUNING.propertySaleFee, 0)} fee)
          </button>
        </>
      )}
    </Modal>
  );
}
