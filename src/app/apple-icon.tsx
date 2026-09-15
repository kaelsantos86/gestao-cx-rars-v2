import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #087A60 0%, #075D4B 48%, #053F35 100%)',
          color: 'white',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, marginBottom: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 12, background: 'rgba(255,255,255,.75)' }} />
          <div style={{ width: 16, height: 16, borderRadius: 16, background: '#FFFFFF' }} />
          <div style={{ width: 12, height: 12, borderRadius: 12, background: 'rgba(255,255,255,.75)' }} />
        </div>
        <div style={{ display: 'flex', fontSize: 58, fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}>CX</div>
        <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, letterSpacing: 4, marginLeft: 4, opacity: .92 }}>RARS</div>
      </div>
    ),
    { ...size },
  );
}
