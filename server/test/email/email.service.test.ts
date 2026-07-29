import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from 'src/email/email.service';

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock('resend', () => {
  return {
    Resend: vi.fn().mockImplementation(function (this: any) {
      this.emails = { send: mockSend };
    }),
  };
});

const config = {
  getOrThrow: vi.fn((key: string) => {
    if (key === 'RESEND_API_KEY') return 're_test_key';
    if (key === 'EMAIL_FROM') return 'SoTreina <contas@sotreina.com>';
    throw new Error(`unexpected key ${key}`);
  }),
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ data: { id: 'email_1' }, error: null });

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService, { provide: ConfigService, useValue: config }],
    }).compile();

    service = module.get(EmailService);
  });

  describe('sendWelcomeEmail', () => {
    it('sends with the configured from address and a greeting using the first name', async () => {
      await service.sendWelcomeEmail('test@example.com', 'Guilherme');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'SoTreina <contas@sotreina.com>',
          to: 'test@example.com',
          subject: expect.stringContaining('SoTreina'),
          html: expect.stringContaining('Guilherme'),
          text: expect.stringContaining('Guilherme'),
        }),
      );
    });

    it('falls back to a generic greeting when firstName is null', async () => {
      await service.sendWelcomeEmail('test@example.com', null);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).not.toContain('null');
      expect(call.text).not.toContain('null');
    });

    it('does not throw when Resend returns an error', async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'invalid api key' },
      });

      await expect(
        service.sendWelcomeEmail('test@example.com', 'Guilherme'),
      ).resolves.toBeUndefined();
    });

    it('does not throw when the Resend call itself rejects', async () => {
      mockSend.mockRejectedValueOnce(new Error('network down'));

      await expect(
        service.sendWelcomeEmail('test@example.com', 'Guilherme'),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends with the reset URL embedded in the body', async () => {
      const resetUrl = 'https://sotreina.vercel.app/redefinir-senha?token=abc123';

      await service.sendPasswordResetEmail('test@example.com', resetUrl);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          html: expect.stringContaining(resetUrl),
          text: expect.stringContaining(resetUrl),
        }),
      );
    });

    it('does not throw when Resend returns an error', async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'invalid api key' },
      });

      await expect(
        service.sendPasswordResetEmail('test@example.com', 'https://sotreina.vercel.app'),
      ).resolves.toBeUndefined();
    });
  });
});
