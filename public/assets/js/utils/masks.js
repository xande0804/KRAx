// public/assets/js/utils/masks.js
(function () {

  function maskCPF(value) {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .slice(0, 14);
  }

  function maskPhone(value) {
    return value
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .slice(0, 15);
  }

  // ⚠️ VALIDAÇÃO CPF (comentada para DEV)
    /*
    function validarCPF(cpf) {
      cpf = cpf.replace(/\D/g, "");
      if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  
      let soma = 0;
      for (let i = 0; i < 9; i++) soma += cpf[i] * (10 - i);
      let dig1 = (soma * 10) % 11;
      if (dig1 === 10) dig1 = 0;
      if (dig1 != cpf[9]) return false;
  
      soma = 0;
      for (let i = 0; i < 10; i++) soma += cpf[i] * (11 - i);
      let dig2 = (soma * 10) % 11;
      if (dig2 === 10) dig2 = 0;
      if (dig2 != cpf[10]) return false;
  
      return true;
    }
    */

  // ✅ Leve: só a primeira letra do texto em maiúscula
  // (mantém o resto como o usuário digitou)
  function capitalizeFirst(value) {
    let s = String(value ?? "");

    // normaliza espaços duplicados, sem remover espaço final enquanto digita
    s = s.replace(/\s+/g, " ");

    // tira espaços só do começo (pra achar a primeira letra)
    const trimmedStart = s.replace(/^\s+/, "");
    if (!trimmedStart) return s;

    // índice da primeira letra no texto original
    const firstIndex = s.length - trimmedStart.length;

    return (
      s.slice(0, firstIndex) +
      trimmedStart.charAt(0).toUpperCase() +
      trimmedStart.slice(1)
    );
  }

  // ✅ Placa: AAA 1234 (ou Mercosul). Sempre uppercase e espaço após 3 chars
  function maskPlaca(value) {
    let s = String(value ?? "")
      .replace(/[^a-zA-Z0-9]/g, "") // remove hífen/espaço etc
      .toUpperCase()
      .slice(0, 7); // 7 chars sem o espaço

    if (s.length <= 3) return s;
    return s.slice(0, 3) + " " + s.slice(3);
  }

  function applyMasks(container = document) {
    const cpfInputs = container.querySelectorAll('input[name="cpf"]');
    const phoneInputs = container.querySelectorAll('input[name="telefone"]');

    // ✅ novos campos do seu modal
    const nomeInputs = container.querySelectorAll('input[name="nome"]');
    const profInputs = container.querySelectorAll('input[name="profissao"]');
    const indicInputs = container.querySelectorAll('input[name="indicacao"]');
    const placaInputs = container.querySelectorAll('input[name="placa_carro"]');

    cpfInputs.forEach(input => {
      input.addEventListener("input", () => {
        input.value = maskCPF(input.value);
      });
    });

    phoneInputs.forEach(input => {
      input.addEventListener("input", () => {
        input.value = maskPhone(input.value);
      });
    });

    // Primeira letra maiúscula (nome/profissão/indicação)
    [...nomeInputs, ...profInputs, ...indicInputs].forEach(input => {
      input.addEventListener("input", () => {
        input.value = capitalizeFirst(input.value);
      });
    });

    // Placa com espaço após 3
    placaInputs.forEach(input => {
      input.addEventListener("input", () => {
        input.value = maskPlaca(input.value);
      });
    });
  }

  window.applyMasks = applyMasks;

})();
