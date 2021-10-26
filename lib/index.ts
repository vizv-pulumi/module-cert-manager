import * as k8s from '@pulumi/kubernetes'
import * as pulumi from '@pulumi/pulumi'
import * as certmanager from '@vizv/crds-cert-manager'

export * from '@vizv/crds-cert-manager'

export interface CertManagerArgs {
  namespaceName: pulumi.Input<string>
  cloudflareApiToken: pulumi.Input<string>
  acmeServer: pulumi.Input<string>
}

export class CertManager extends pulumi.ComponentResource {
  public readonly chart: k8s.helm.v3.Chart
  public readonly secretCloudflareApiToken: k8s.core.v1.Secret
  public readonly acmeLetsencryptClusterIssuer: certmanager.v1.ClusterIssuer
  public readonly selfSignedClusterIssuer: certmanager.v1.ClusterIssuer

  constructor(
    name: string,
    args: CertManagerArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super('vizv:module:CertManager', name, {}, opts)

    this.chart = new k8s.helm.v3.Chart(
      name,
      {
        chart: 'cert-manager',
        fetchOpts: {
          repo: 'https://vizv-pulumi.github.io/helm-charts',
        },
        namespace: args.namespaceName,
        values: {
          installCRDs: true,
        },
      },
      {
        parent: this,
        protect: opts?.protect,
        dependsOn: opts?.dependsOn,
      },
    )

    const secretCloudflareApiTokenName = `${name}-cloudflare-api-token`
    this.secretCloudflareApiToken = new k8s.core.v1.Secret(
      secretCloudflareApiTokenName,
      {
        metadata: {
          name: secretCloudflareApiTokenName,
          namespace: args.namespaceName,
        },
        type: 'Opaque',
        stringData: {
          token: args.cloudflareApiToken,
        },
      },
      {
        parent: this,
        protect: opts?.protect,
      },
    )

    this.acmeLetsencryptClusterIssuer = new certmanager.v1.ClusterIssuer(
      'acme-letsencrypt',
      {
        metadata: {
          name: 'acme-letsencrypt',
          namespace: args.namespaceName,
        },
        spec: {
          acme: {
            server: args.acmeServer,
            privateKeySecretRef: {
              name: `${name}-letsencrypt-private-key`,
            },
            solvers: [
              {
                dns01: {
                  cloudflare: {
                    apiTokenSecretRef: {
                      name: this.secretCloudflareApiToken.metadata.name,
                      key: 'token',
                    },
                  },
                },
              },
            ],
          },
        },
      },
      {
        parent: this,
        protect: opts?.protect,
        dependsOn: this.chart.ready.apply((resources) => [
          ...resources,
          this.secretCloudflareApiToken,
        ]),
      },
    )

    this.selfSignedClusterIssuer = new certmanager.v1.ClusterIssuer(
      'selfsigned',
      {
        metadata: {
          name: 'selfsigned',
          namespace: args.namespaceName,
        },
        spec: {
          selfSigned: {},
        },
      },
      {
        parent: this,
        protect: opts?.protect,
        dependsOn: this.chart.ready,
      },
    )
  }
}
