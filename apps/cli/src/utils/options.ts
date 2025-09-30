import { type Command, Option } from "commander";

const FORMAT_CHOICES = ["text", "json"] as const;

type LoggingOptionConfig = {
  readonly includeDefaultFormat?: boolean;
  readonly includeDeprecatedJsonAlias?: boolean;
};

export const addLoggingOptions = <T extends Command>(
  command: T,
  {
    includeDefaultFormat = false,
    includeDeprecatedJsonAlias = true,
  }: LoggingOptionConfig = {}
): T => {
  const formatOption = new Option(
    "--format <mode>",
    "Output format: text|json"
  ).choices([...FORMAT_CHOICES]);

  if (includeDefaultFormat) {
    formatOption.default("text");
  }

  command.addOption(formatOption);

  if (includeDeprecatedJsonAlias) {
    command.addOption(
      new Option(
        "--json",
        "Output JSON logs (deprecated, use --format json)"
      ).hideHelp()
    );
  }

  if (includeDefaultFormat) {
    command.option(
      "--log-level <level>",
      "Log level: debug|info|warn|error",
      "info"
    );
  } else {
    command.option("--log-level <level>", "Log level: debug|info|warn|error");
  }

  command.option("-q, --quiet", "Quiet mode: only errors are printed");

  return command;
};
