import { NextApiRequest, NextApiResponse } from 'next';
import { Readable } from 'stream';
import Stripe from 'stripe';

import { stripe } from './../../services/stripe';
import { saveSubscription } from './_lib/manageSubscription';

async function buffer(readable: Readable) {
  const chunks = [];

  for await (const chunck of readable) {
    chunks.push(typeof chunck === 'string' ? Buffer.from(chunck) : chunck);
  }

  return Buffer.concat(chunks);
}

export const config = {
  api: {
    bodyParser: false,
  },
};

const relevantEvents = new Set([
  'checkout.session.completed',
  'customer.subscriptions.created',
  'customer.subscriptions.updated',
  'customer.subscriptions.deleted',
]);

export default async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method not permitted');
  }

  const buf = await buffer(req);
  const secret = req.headers['stripe-signature'];

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      secret,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  const { type } = event;

  if (!relevantEvents.has(type)) {
    return res.status(200).json({ ok: true });
  }

  try {
    switch (type) {
      case 'customer.subscriptions.created':
      case 'customer.subscriptions.created':
      case 'customer.subscriptions.created':
        const subscription = event.data.object as Stripe.Subscription;

        await saveSubscription(
          subscription.id,
          subscription.customer.toString(),
          type === 'customer.subscriptions.created',
        );

        break;
      case 'checkout.session.completed':
        const checkoutSession = event.data.object as Stripe.Checkout.Session;

        await saveSubscription(
          checkoutSession.subscription.toString(),
          checkoutSession.customer.toString(),
          true,
        );
        break;
      default:
        throw new Error('Unhandled event.');
    }
  } catch (err) {
    return res.json({ error: 'Webhook handled failed' });
  }
};
