export interface DeviceRegistration {
  userId: string;
  platform: "ios" | "android";
  token: string;
  updatedAt: string;
}

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface CreatePushServiceOptions {
  apns?: {
    keyId: string;
    teamId: string;
    bundleId: string;
    privateKeyPem?: string;
  };
  fcm?: {
    projectId: string;
    serviceAccountJson?: string;
  };
  transport?: (device: DeviceRegistration, msg: PushMessage) => Promise<void>;
}

export interface PandPushService {
  registerDevice: (input: {
    userId: string;
    platform: "ios" | "android";
    token: string;
  }) => DeviceRegistration;
  listUserDevices: (userId: string) => DeviceRegistration[];
  sendToUser: (userId: string, msg: PushMessage) => Promise<{ delivered: number }>;
}

export function createPushService(options: CreatePushServiceOptions = {}): PandPushService {
  const devicesByUser = new Map<string, DeviceRegistration[]>();

  return {
    registerDevice({ userId, platform, token }) {
      const existing = (devicesByUser.get(userId) ?? []).filter((d) => d.token !== token);
      const record: DeviceRegistration = {
        userId,
        platform,
        token,
        updatedAt: new Date().toISOString(),
      };
      existing.push(record);
      devicesByUser.set(userId, existing);
      return record;
    },

    listUserDevices(userId) {
      return devicesByUser.get(userId) ?? [];
    },

    async sendToUser(userId, msg) {
      const devices = devicesByUser.get(userId) ?? [];
      let delivered = 0;
      for (const dev of devices) {
        if (options.transport) {
          await options.transport(dev, msg);
        }
        delivered += 1;
      }
      return { delivered };
    },
  };
}
