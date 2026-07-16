import { buildEvent } from '../../helpers/event';

// Mock do presigner: evita a cadeia de credenciais/rede da AWS e nos dá uma URL previsível.
const getSignedUrl = jest.fn().mockResolvedValue('https://s3.amazonaws.com/signed-put-url');
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl }));

process.env.BUCKET_NAME = 'meu-bucket';
process.env.AWS_REGION = 'us-east-1';

const { handler } = require('../../../src/functions/uploads/generate-url') as {
  handler: (event: any) => Promise<{ statusCode: number; body: string }>;
};

beforeEach(() => getSignedUrl.mockClear());

describe('POST /uploads/presigned-url', () => {
  it('retorna 200 com uploadUrl assinada e mediaUrl pública', async () => {
    const res = await handler(buildEvent({ body: { contentType: 'image/png' } }));
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.uploadUrl).toBe('https://s3.amazonaws.com/signed-put-url');
    expect(body.mediaUrl).toMatch(
      /^https:\/\/meu-bucket\.s3\.amazonaws\.com\/[0-9a-f-]+\.png$/,
    );
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('assina a URL com expiração de 60 segundos', async () => {
    await handler(buildEvent({ body: { contentType: 'image/jpeg' } }));
    expect(getSignedUrl.mock.calls[0][2]).toEqual({ expiresIn: 60 });
  });

  it('deriva a extensão do arquivo a partir do contentType', async () => {
    const res = await handler(buildEvent({ body: { contentType: 'image/webp' } }));
    expect(JSON.parse(res.body).mediaUrl).toMatch(/\.webp$/);
  });

  it('retorna 400 quando o corpo está vazio', async () => {
    const res = await handler(buildEvent({ body: undefined }));
    expect(res.statusCode).toBe(400);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it.each(['application/pdf', 'image/gif', 'text/plain'])(
    'retorna 400 para o mime type não permitido %s',
    async (contentType) => {
      const res = await handler(buildEvent({ body: { contentType } }));
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/não permitido/i);
      expect(getSignedUrl).not.toHaveBeenCalled();
    },
  );

  it('retorna 500 quando a assinatura falha', async () => {
    getSignedUrl.mockRejectedValueOnce(new Error('sign error'));
    const res = await handler(buildEvent({ body: { contentType: 'image/png' } }));
    expect(res.statusCode).toBe(500);
  });
});
