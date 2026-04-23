// FeedPost — Twitter-style card with embedded coupon

function FeedPost({ post, onSaveCoupon, onFollow }) {
  return (
    <div className="up-post">
      <div className="up-post-head">
        <StoreAvatar name={post.store} emoji={post.emoji} />
        <div className="up-post-info">
          <div className="up-post-name">{post.store}</div>
          <div className="up-post-meta">{post.category} · {post.time}</div>
        </div>
        <button
          className={`up-btn up-btn-small ${post.following ? 'up-btn-filled-gray' : 'up-btn-primary'}`}
          onClick={()=>onFollow(post.id)}
        >
          {post.following ? '팔로잉' : '+ 팔로우'}
        </button>
      </div>
      <div className="up-post-body">{post.body}</div>
      {post.coupon && (
        <CouponInline
          title={post.coupon.title}
          badge={post.coupon.badge}
          meta={post.coupon.meta}
          saved={post.coupon.saved}
          onSave={()=>onSaveCoupon(post.id)}
        />
      )}
      <div className="up-post-actions">
        <button className="up-post-action">❤️ {post.likes}</button>
        <button className="up-post-action">💬 {post.comments}</button>
        <button className="up-post-action">🔁 공유</button>
      </div>
    </div>
  );
}

Object.assign(window, { FeedPost });
