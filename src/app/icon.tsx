import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
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
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginBottom: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 30, height: 30, borderRadius: 30, background: 'rgba(255,255,255,.76)' }} />
            <div style={{ width: 58, height: 35, borderRadius: '28px 28px 12px 12px', background: 'rgba(255,255,255,.76)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 38, height: 38, borderRadius: 38, background: '#FFFFFF' }} />
            <div style={{ width: 72, height: 43, borderRadius: '34px 34px 14px 14px', background: '#FFFFFF' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 30, height: 30, borderRadius: 30, background: 'rgba(255,255,255,.76)' }} />
            <div style={{ width: 58, height: 35, borderRadius: '28px 28px 12px 12px', background: 'rgba(255,255,255,.76)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 150, fontWeight: 800, lineHeight: 1, letterSpacing: -8 }}>CX</div>
        <div style={{ display: 'flex', fontSize: 42, fontWeight: 700, letterSpacing: 12, marginLeft: 12, opacity: .92 }}>RARS</div>
        <div style={{ display: 'flex', width: 190, height: 10, borderRadius: 10, background: 'rgba(255,255,255,.32)', marginTop: 24 }} />
      </div>
    ),
    { ...size },
  );
}
