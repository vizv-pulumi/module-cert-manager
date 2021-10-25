import * as pulumi from '@pulumi/pulumi'
import { CertManager } from './lib'

const config = new pulumi.Config()

new CertManager('cert-manager', {
  namespaceName: config.get('namespaceName') || 'default',
  cloudflareApiToken: config.requireSecret('cloudflareApiToken'),
  acmeServer: 'https://acme-v02.api.letsencrypt.org/directory',
})
