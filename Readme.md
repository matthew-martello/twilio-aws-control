# Readme - Twilio AWS Control Stack

This repo contains a small CloudFormation template that creates a REST API and Lambda functions enabling a Twilio Voice Incoming webhook to control the running state of an EC2 instance.

![Architecture Diagram](./architecture.png)

## Scripts

```
.
├── deploy.sh
└── validate.sh
```

### Deploy

The `deploy.sh` script packages the Lambda code and `template.yaml` file and uploads it to a predefined S3 bucket. The upload bucket is specified in `.env` as `CF_BUCKET_NAME`.

Run the script from it's folder:

```bash
./deploy.sh
```

### Validate

The `validate.sh` script simply runs the `aws cloudformation validate-template` command against the `template.yaml` file. If the initial validation passes, it then runs `cfn-lint` to catch any additional errors.

Run the script from it's folder:

```bash
./validate.sh
```

## Configuring Twilio

> _Updated 16 June 2026_

In the Twilio Developer console, locate the configuration for the number to connect. In the left sidebar: **Develop** > **Phone Numbers** > **Manage** > **Active Numbers**. Select the number and view the **Configure** tab.

Under the **Voice Configuration** section apply the following settings:

- **Configure with**
  - _Webhook, TwiML Bin, Function, Studio Flow, Proxy Service_
- **A call comes in**
  - _Webhook_
- **URL**
  - _\*Copy the `VoiceIncomingWebhookUrl` value from the CloudFormation output._
- **HTTP**
  - _HTTP POST_

## Environment Variables

Stack parameters are provided via `.env`. Some values are pre-defined, but can be changed to suit your preference.

|    Variable Name     |     Default Value      | Description                                                                                                                                                                       |
| :------------------: | :--------------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|     `AWS_REGION`     |                        | Region to deploy stack in.                                                                                                                                                        |
|     `STACK_NAME`     |   twilio-aws-control   | Name of the CloudFormation Stack.                                                                                                                                                 |
|     `PROJECT_ID`     |   TWILIO_AWS_CONTROL   | Used for tagging resources with the `ProjectId` tag.                                                                                                                              |
|    `TWILIO_VOICE`    | en-AU-Chirp3-HD-Charon | Name of the text-to-speech voice used by Twilio. See [available languages](https://www.twilio.com/docs/voice/twiml/say/text-speech#available-voices-and-languages) for full list. |
|   `CF_BUCKET_NAME`   |                        | S3 Bucket name to hold CloudFormation package artifacts.                                                                                                                          |
|  `EC2_INSTANCE_ID`   |                        | EC2 Instance ID to control via Twilio                                                                                                                                             |
| `PHONE_NO_WHITELIST` |                        | A comma seperated string of E.164 phone numbers (with no spaces).                                                                                                                 |
