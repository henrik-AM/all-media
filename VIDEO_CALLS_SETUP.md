# Video Call Implementation Guide (Phase 3)

## Overview

Video calls in All Media will support:
- 1-on-1 voice & video calls
- Group video calls (up to 8 participants)
- Call signaling via Supabase Realtime
- WebRTC for peer-to-peer media

## Architecture

### Technologies
- **WebRTC:** Peer-to-peer media (expo-webrtc or similar)
- **Signaling:** Supabase Realtime channels for call invitations and state
- **TURN Server:** For NAT traversal (e.g., TURN server or Supabase relay)
- **State Management:** Redux or Context API for call state (ringing, connected, ended)

### Call Flow

1. **Initiate:** User taps call button → sends invite via Supabase channel
2. **Ring:** Recipient receives notification, shows accept/decline UI
3. **Accept:** Both peers create WebRTC offer/answer via Realtime
4. **Connect:** ICE candidates exchanged, media streams established
5. **Active:** Video/audio flows peer-to-peer
6. **End:** Either peer hangs up, connection closes

## Required Libraries

```bash
npm install expo-webrtc expo-av

# Optional for better signaling
npm install react-native-webrtc-kit
```

## Implementation Steps

### Step 1: Call State Context
Create `app/contexts/CallContext.tsx`:
```typescript
interface CallState {
  activeCall: Call | null;
  isRinging: boolean;
  participants: Participant[];
  toggleAudio: () => void;
  toggleVideo: () => void;
  startCall: (contactId: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
}
```

### Step 2: Call Signaling Service
Create `app/lib/callSignaling.ts`:
- Listen on Supabase channel: `call:${userId}`
- Handle events: `call_invite`, `call_accept`, `call_decline`, `call_ended`
- Exchange WebRTC offers/answers via Realtime

### Step 3: Call Screen
Create `app/screens/messenger/CallScreen.tsx`:
- Two-part UI: Ringing screen + Active call screen
- Show participant avatars and name
- Audio/video toggle buttons
- Hang up button
- Grid layout for group calls

### Step 4: Notification Integration
Extend NotificationContext to handle incoming calls:
- Show full-screen call notification
- Play ringing sound
- Haptic feedback

## Database Updates

Add to Supabase schema:

```sql
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id UUID NOT NULL REFERENCES public.users(id),
  recipient_ids UUID[] NOT NULL,
  status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'ringing', 'active', 'ended')),
  media_types VARCHAR[] DEFAULT ARRAY['audio', 'video'],
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE public.call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  sdp_offer TEXT,
  sdp_answer TEXT,
  ice_candidates JSONB,
  joined_at TIMESTAMP DEFAULT NOW()
);
```

## Testing

### Local Testing
1. Open app on two simulators/devices
2. Navigate to ChatDetailScreen
3. Tap video call icon
4. Other user sees incoming call notification
5. Accept → WebRTC connection established
6. Both see video feed (or audio only if camera blocked)
7. Hang up → connection closes

### Common Issues
- **No audio/video:** Check permissions (Camera, Microphone)
- **No connection:** Verify TURN server is reachable
- **Echo:** Enable audio processing in WebRTC config
- **Permission denied:** iOS requires Info.plist NSCameraUsageDescription

## iOS/Android Permissions

### iOS (Info.plist)
```xml
<key>NSCameraUsageDescription</key>
<string>All Media needs camera access for video calls</string>
<key>NSMicrophoneUsageDescription</key>
<string>All Media needs microphone access for calls</string>
```

### Android (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

## Production Considerations

- **TURN Server:** Use Supabase Relay or external TURN service (coturn)
- **Bandwidth:** Adaptive bitrate for low-bandwidth users
- **Battery:** Disable video when app backgrounded
- **Timeouts:** End call if not answered after 60s
- **Recording:** Legal compliance if recording calls (GDPR, etc.)

## References

- WebRTC Basics: https://webrtc.org/
- Expo AV: https://docs.expo.dev/versions/latest/sdk/av/
- Supabase Realtime: https://supabase.com/docs/guides/realtime
- SDP Offer/Answer: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API

## Status

- [ ] Step 1: CallContext
- [ ] Step 2: Signaling service
- [ ] Step 3: CallScreen UI
- [ ] Step 4: Notifications
- [ ] Step 5: Testing on real devices
- [ ] Step 6: Production deployment

---

**This is Phase 3 follow-up work.** Core chat/stories/presence come first.
