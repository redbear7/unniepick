-- ══════════════════════════════════════════════════════════════
--  get_nearby_stores — 내 위치 기반 가게 목록 (PostGIS ST_Distance)
--  (Step 5: NearbyFeedScreen 위치 기반 쿼리)
-- ══════════════════════════════════════════════════════════════

-- stores 테이블에 geometry 컬럼이 없을 경우 latitude/longitude로 계산
-- PostGIS가 활성화되어 있어야 함 (Supabase는 기본 활성화)

create or replace function get_nearby_stores(
  user_lat   double precision,
  user_lng   double precision,
  radius_km  double precision default 5.0,
  max_count  int default 30
)
returns table (
  store_id     uuid,
  store_name   text,
  latitude     double precision,
  longitude    double precision,
  district_id  uuid,
  district_name text,
  distance_km  double precision,
  active_coupon_count int,
  latest_coupon_kind  text,
  unread_post_count   int
)
language sql stable as $$
  with ranked_stores as (
    select
      s.id                as store_id,
      s.name              as store_name,
      s.latitude,
      s.longitude,
      s.district_id,
      d.name              as district_name,
      -- 위도·경도 기반 Haversine 거리 (km)
      (
        6371 * acos(
          cos(radians(user_lat)) * cos(radians(s.latitude)) *
          cos(radians(s.longitude) - radians(user_lng)) +
          sin(radians(user_lat)) * sin(radians(s.latitude))
        )
      )                   as distance_km
    from stores s
    left join districts d on d.id = s.district_id
    where
      s.latitude is not null
      and s.longitude is not null
      and s.is_active = true      -- 활성 가게만
  ),
  store_coupons as (
    select
      c.store_id,
      count(*) filter (
        where c.is_active = true and c.expires_at > now()
      )                           as active_coupon_count,
      (
        select c2.coupon_kind
        from coupons c2
        where c2.store_id = c.store_id
          and c2.is_active = true
          and c2.expires_at > now()
        order by c2.created_at desc
        limit 1
      )                           as latest_coupon_kind
    from coupons c
    group by c.store_id
  ),
  store_posts as (
    select
      p.store_id,
      count(*) as post_count
    from store_posts p
    where p.created_at > now() - interval '7 days'  -- 최근 7일
    group by p.store_id
  )
  select
    rs.store_id,
    rs.store_name,
    rs.latitude,
    rs.longitude,
    rs.district_id,
    rs.district_name,
    round(rs.distance_km::numeric, 2)::double precision  as distance_km,
    coalesce(sc.active_coupon_count, 0)::int             as active_coupon_count,
    coalesce(sc.latest_coupon_kind, '')                  as latest_coupon_kind,
    coalesce(sp.post_count, 0)::int                      as unread_post_count
  from ranked_stores rs
  left join store_coupons sc on sc.store_id = rs.store_id
  left join store_posts   sp on sp.store_id = rs.store_id
  where rs.distance_km <= radius_km
  order by rs.distance_km asc
  limit max_count;
$$;
